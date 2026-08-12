import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import { fixtureDeclarationsOf } from "../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import {
  asSpecFunction,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  groupingBlockBindings,
  testCallbacksOf,
} from "../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

const ANONYMOUS_DECLARATION_NAME = "default";

type ScopeReading = {
  readonly functions: readonly ESTree.Node[];
  readonly groupingBodies: readonly ESTree.Node[];
};

type HelperReport = {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: { readonly name: string };
};

type BindingReading = {
  readonly lookup: ScopeLookup;
  readonly source: string;
};

const spans = (holder: ESTree.Node, held: ESTree.Node): boolean =>
  holder.start <= held.start && held.end <= holder.end;

const innermostHolderOf = (
  held: ESTree.Node,
  holders: readonly ESTree.Node[],
): ESTree.Node | null =>
  holders
    .filter((holder) => spans(holder, held) && !spans(held, holder))
    .toSorted((first, second) => second.start - first.start)
    .at(0) ?? null;

const standsInHelperScope = (held: ESTree.Node, reading: ScopeReading): boolean => {
  const holder = innermostHolderOf(held, reading.functions);
  if (holder === null) return true;
  return reading.groupingBodies.some(
    (body) => body.start === holder.start && body.end === holder.end,
  );
};

const heldFunctionsIn = (node: ESTree.Expression): readonly ESTree.Expression[] => {
  const written = unwrapSubject(node);
  return asSpecFunction(written) === null ? functionsInLiteral(written) : [written];
};

const functionsInLiteral = (written: ESTree.Expression): readonly ESTree.Expression[] => {
  if (written.type === "ObjectExpression") {
    return written.properties.flatMap((property) =>
      property.type === "Property" ? heldFunctionsIn(property.value) : [],
    );
  }
  if (written.type !== "ArrayExpression") return [];
  return written.elements.flatMap((element) =>
    element === null || element.type === "SpreadElement" ? [] : heldFunctionsIn(element),
  );
};

const functionsHeldByLiteral = (initializer: ESTree.Expression): readonly ESTree.Expression[] => {
  const written = unwrapSubject(initializer);
  if (written.type !== "ObjectExpression" && written.type !== "ArrayExpression") return [];
  return functionsInLiteral(written);
};

const functionsHandedBack = (fn: SpecFunction): readonly ESTree.Expression[] =>
  returnedExpressionsOf(fn).flatMap((handed) => {
    const written = unwrapSubject(handed);
    return asSpecFunction(written) === null ? [] : [written];
  });

const anythingHandedBack = (fn: SpecFunction): readonly ESTree.Expression[] =>
  returnedExpressionsOf(fn).flatMap((handed) => heldFunctionsIn(handed));

const declaredFunctionOf = (declared: ESTree.Node): SpecFunction | null => {
  if (declared.type === "FunctionDeclaration") return declared;
  if (declared.type !== "VariableDeclarator" || declared.init === null) return null;
  return asSpecFunction(declared.init);
};

const sameFileFactoryOf = (callee: ESTree.Expression, lookup: ScopeLookup): SpecFunction | null => {
  const written = unwrapSubject(callee);
  if (written.type !== "Identifier") return null;

  const binding = resolveBinding(lookup(written), written.name);
  if (binding === null) return null;
  return (
    binding.defs
      .map((definition) => declaredFunctionOf(definition.node))
      .find((declared) => declared !== null) ?? null
  );
};

const disguisedYieldOf = (
  initializer: ESTree.Expression,
  lookup: ScopeLookup,
): readonly ESTree.Expression[] => {
  const written = unwrapSubject(initializer);
  if (written.type !== "CallExpression") return [];

  const invoked = asSpecFunction(written.callee);
  if (invoked !== null) return anythingHandedBack(invoked);

  const factory = sameFileFactoryOf(written.callee, lookup);
  return factory === null ? [] : functionsHandedBack(factory);
};

const boundNameOf = (target: ESTree.VariableDeclarator["id"], source: string): string =>
  target.type === "Identifier" ? target.name : source.slice(target.start, target.end);

const bindingReportOf = (
  declarator: ESTree.VariableDeclarator,
  reading: BindingReading,
): HelperReport | null => {
  const { init } = declarator;
  if (init === null) return null;

  const naming = { name: boundNameOf(declarator.id, reading.source) };
  if (asSpecFunction(init) !== null) {
    return { node: declarator, messageId: "scopedHelperBinding", data: naming };
  }
  if (functionsHeldByLiteral(init).length !== 0) {
    return { node: declarator, messageId: "containedHelperBinding", data: naming };
  }
  if (disguisedYieldOf(init, reading.lookup).length !== 0) {
    return { node: declarator, messageId: "disguisedHelperBinding", data: naming };
  }
  return null;
};

const fixtureReportsOf = (call: ESTree.CallExpression): readonly HelperReport[] =>
  fixtureDeclarationsOf(call).flatMap((declaration) =>
    declaration.subjects.flatMap((subject) => {
      const handed = asSpecFunction(subject);
      if (handed === null) return [];
      return [
        {
          node: handed,
          messageId: "handedHelperFixture",
          data: { name: declaration.name },
        },
      ];
    }),
  );

export const noSpecFileHelperFunction = createDontReviewItRule({
  name: "no-spec-file-helper-function--inline-or-use-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a helper function standing at module scope or in the body of a grouping block of a spec file, and a fixture handing back a function written in place, so the block that names a behaviour also spells out the work that behaviour runs",
      relatedGuidelines: [],
    },
    messages: {
      scopedHelperDeclaration:
        "A function declaration must not stand at module scope or in the body of a grouping block. Inline the body of `{{name}}` into the test block that uses it, or have a base fixture run that behaviour and hand back the subject it built. Renaming the declaration and moving it into another grouping block keep it in the same scope.",
      scopedHelperBinding:
        "A binding initialised with a function must not stand at module scope or in the body of a grouping block. Inline the body of `{{name}}` into the test block that uses it, or have a base fixture run that behaviour and hand back the subject it built. Renaming the binding and moving it into another grouping block keep it in the same scope.",
      disguisedHelperBinding:
        "A binding must not take its value from a call that hands back a function. Inline the body of `{{name}}` into the test block that uses it, or have a base fixture run that behaviour and hand back the subject it built. An immediately invoked call, a return written inside a branch, a loop, a `switch` or a `try`, and a factory declared in this file are read the same way.",
      containedHelperBinding:
        "A binding must not carry functions inside an object or an array literal at module scope or in the body of a grouping block. Inline each function `{{name}}` carries into the test block that uses it, or have a base fixture run those behaviours and hand back the subjects they built. Nesting the literal deeper keeps the functions in the same scope.",
      handedHelperFixture:
        "A fixture must not hand back a function written in place. Rewrite `{{name}}` to run that behaviour itself and hand back the subject it built, and leave the assertions against that subject standing in the test block. A fixture named anything at all is read the same way.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const binding: BindingReading = {
      lookup: (node) => context.sourceCode.getScope(node),
      source: context.sourceCode.text,
    };
    const bindings = groupingBlockBindings();
    const functions = new Set<ESTree.Node>();
    const calls = new Set<ESTree.CallExpression>();
    const declarations = new Set<ESTree.Function>();
    const declarators = new Set<ESTree.VariableDeclarator>();

    const takeFunction = (node: ESTree.Function | ESTree.ArrowFunctionExpression): void => {
      functions.add(node);
    };

    const scopeReadingOf = (): ScopeReading => {
      const rootNames = bindings.rootNames();
      return {
        functions: [...functions],
        groupingBodies: [...calls]
          .filter((call) => declaresTestBlock(call, rootNames))
          .flatMap((call) => testCallbacksOf(call)),
      };
    };

    return {
      ImportDeclaration: bindings.takeImport,
      FunctionDeclaration(node: ESTree.Function) {
        takeFunction(node);
        declarations.add(node);
      },
      FunctionExpression: takeFunction,
      ArrowFunctionExpression: takeFunction,
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        bindings.takeLocalBinding(node);
        declarators.add(node);
      },
      CallExpression(node: ESTree.CallExpression) {
        calls.add(node);
      },
      "Program:exit"() {
        const reading = scopeReadingOf();

        for (const declared of declarations) {
          if (!standsInHelperScope(declared, reading)) continue;
          context.report({
            node: declared,
            messageId: "scopedHelperDeclaration",
            data: { name: declared.id?.name ?? ANONYMOUS_DECLARATION_NAME },
          });
        }
        for (const declarator of declarators) {
          if (!standsInHelperScope(declarator, reading)) continue;
          const report = bindingReportOf(declarator, binding);
          if (report !== null) context.report(report);
        }
        for (const call of calls) {
          for (const report of fixtureReportsOf(call)) context.report(report);
        }
      },
    };
  },
});
