import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
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
  testBlockRootNames,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

const ASSERTION_ENTRY = "expect";

const contextPatternOf = (callback: SpecFunction): ESTree.ObjectPattern | null => {
  const [parameter] = callback.params;
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

const contextBindingsOf = (callback: SpecFunction): readonly HeldContext[] => {
  const name = fixtureContextParameterName(callback);
  return name === null ? [] : [{ name, start: callback.start, end: callback.end }];
};

const contextReachesIn = (program: ESTree.Program): readonly ContextReach[] =>
  nodesOfType(program, "MemberExpression").flatMap((node) => {
    if (node.computed) return [];
    if (staticMemberName(node) !== ASSERTION_ENTRY) return [];

    const receiver = unwrapSubject(node.object);
    return receiver.type === "Identifier" ? [{ node, name: receiver.name }] : [];
  });

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
  create(context) {
    const reportTakenEntry = (callback: SpecFunction): void => {
      const pattern = contextPatternOf(callback);
      if (pattern === null) return;

      const taken = takenAssertionEntry(pattern);
      if (taken === null) return;
      context.report({ node: taken, messageId: "destructuredContextExpect" });
    };

    return {
      "Program:exit"(program: ESTree.Program) {
        const rootNames = testBlockRootNames(program);
        const callbacks = nodesOfType(program, "CallExpression")
          .filter((call) => declaresTestBlock(call, rootNames))
          .flatMap((call) => testCallbacksOf(call));

        for (const callback of callbacks) reportTakenEntry(callback);

        const held = callbacks.flatMap((callback) => contextBindingsOf(callback));
        for (const access of contextReachesIn(program)) {
          if (isHeldContextReach(access, held)) {
            context.report({ node: access.node, messageId: "reachedContextExpect" });
          }
        }
      },
    };
  },
});
