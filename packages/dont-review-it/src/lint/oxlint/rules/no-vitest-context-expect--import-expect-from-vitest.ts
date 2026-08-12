import { createDontReviewItRule } from "../../../create-rule.ts";
import { fixtureContextParameterName } from "../lib/spec-syntax/fixture-declarations.ts";
import {
  isHeldContextReach,
  type ContextReach,
  type HeldContext,
} from "../lib/spec-syntax/held-contexts.ts";
import { staticMemberName, staticPropertyName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject, type SpecFunction } from "../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  testBlockBindings,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

const ASSERTION_ENTRY = "expect";

const contextPatternOf = (specCallback: SpecFunction): ESTree.ObjectPattern | null => {
  const [parameter] = specCallback.params;
  if (parameter === undefined) return null;

  const written = parameter.type === "AssignmentPattern" ? parameter.left : parameter;
  return written.type === "ObjectPattern" ? written : null;
};

const takenAssertionEntry = (pattern: ESTree.ObjectPattern): ESTree.BindingProperty | null => {
  const named = pattern.properties.flatMap((property) =>
    property.type === "Property" ? [property] : [],
  );
  if (named.length !== pattern.properties.length) return null;

  const taken = named.filter(
    (property) => !property.computed && staticPropertyName(property) === ASSERTION_ENTRY,
  );
  return taken[0] ?? null;
};

const contextBindingsOf = (specCallback: SpecFunction): readonly HeldContext[] => {
  const parameterName = fixtureContextParameterName(specCallback);
  return parameterName === null
    ? []
    : [{ name: parameterName, start: specCallback.start, end: specCallback.end }];
};

export const noVitestContextExpect = createDontReviewItRule({
  name: "no-vitest-context-expect--import-expect-from-vitest",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow reading `expect` out of the context a test block hands its callback, so every assertion in the suite runs through the one `expect` the file imported from the test runner",
      relatedGuidelines: [],
    },
    messages: {
      destructuredContextExpect:
        "A test callback must not take `expect` out of the test context. Import `expect` from the test runner and leave the callback parameter holding only the fixtures this test uses.",
      reachedContextExpect:
        "A test callback must not reach `expect` through the test context. Import `expect` from the test runner and call that binding.",
    },
    schema: [],
  },
  create(inspection) {
    const bindings = testBlockBindings();
    const calls = new Set<ESTree.CallExpression>();
    const accesses = new Set<ContextReach>();

    const reportTakenEntry = (specCallback: SpecFunction): void => {
      const pattern = contextPatternOf(specCallback);
      if (pattern === null) return;

      const taken = takenAssertionEntry(pattern);
      if (taken === null) return;
      inspection.report({ node: taken, messageId: "destructuredContextExpect" });
    };

    return {
      ImportDeclaration: bindings.takeImport,
      VariableDeclarator: bindings.takeLocalBinding,
      CallExpression(node: ESTree.CallExpression) {
        calls.add(node);
      },
      MemberExpression(node: ESTree.MemberExpression) {
        if (node.computed) return;
        if (staticMemberName(node) !== ASSERTION_ENTRY) return;

        const receiver = unwrapSubject(node.object);
        if (receiver.type !== "Identifier") return;
        accesses.add({ node, name: receiver.name });
      },
      "Program:exit"() {
        const rootNames = bindings.rootNames();
        const specCallbacks = [...calls]
          .filter((call) => declaresTestBlock(call, rootNames))
          .flatMap((call) => testCallbacksOf(call));

        for (const specCallback of specCallbacks) reportTakenEntry(specCallback);

        const held = specCallbacks.flatMap((specCallback) => contextBindingsOf(specCallback));
        for (const access of accesses) {
          if (isHeldContextReach(access, held)) {
            inspection.report({ node: access.node, messageId: "reachedContextExpect" });
          }
        }
      },
    };
  },
});
