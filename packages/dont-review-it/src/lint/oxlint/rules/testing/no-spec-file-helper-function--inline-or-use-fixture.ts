import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { resolveBinding, type ScopeLookup } from "../../lib/resolved-bindings.ts";
import { fixtureDeclarationsOf } from "../../lib/spec-syntax/fixture-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import {
  asSpecFunction,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "../../lib/spec-syntax/subject-expressions.ts";
import {
  declaresTestBlock,
  groupingBlockRootNames,
  testCallbacksOf,
} from "../../lib/spec-syntax/test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";
import type { NamedReport } from "../../lib/named-report.ts";

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
  return written.elements.flatMap((listed) =>
    listed === null || listed.type === "SpreadElement" ? [] : heldFunctionsIn(listed),
  );
};

const fixtureReportsOf = (call: ESTree.CallExpression): readonly NamedReport[] =>
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

type ScopeReading = {
  readonly functions: readonly ESTree.Node[];
  readonly groupingBodies: readonly ESTree.Node[];
};

const scopeReadingIn = (program: ESTree.Program, rootNames: ReadonlySet<string>): ScopeReading => ({
  functions: [
    ...nodesOfType(program, "FunctionDeclaration"),
    ...nodesOfType(program, "FunctionExpression"),
    ...nodesOfType(program, "ArrowFunctionExpression"),
  ],
  groupingBodies: nodesOfType(program, "CallExpression")
    .filter((call) => declaresTestBlock(call, rootNames))
    .flatMap((call) => testCallbacksOf(call)),
});

const ANONYMOUS_DECLARATION_NAME = "default";

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
    (groupingBody) => groupingBody.start === holder.start && groupingBody.end === holder.end,
  );
};

const declarationReportsIn = (
  program: ESTree.Program,
  reading: ScopeReading,
): readonly NamedReport[] =>
  nodesOfType(program, "FunctionDeclaration")
    .filter((declared) => standsInHelperScope(declared, reading))
    .map((declared) => ({
      node: declared,
      messageId: "scopedHelperDeclaration",
      data: { name: declared.id?.name ?? ANONYMOUS_DECLARATION_NAME },
    }));

const functionsHeldByLiteral = (initializer: ESTree.Expression): readonly ESTree.Expression[] => {
  const written = unwrapSubject(initializer);
  if (written.type !== "ObjectExpression" && written.type !== "ArrayExpression") return [];
  return functionsInLiteral(written);
};

const functionsHandedBack = (specFunction: SpecFunction): readonly ESTree.Expression[] =>
  returnedExpressionsOf(specFunction).flatMap((handed) => {
    const written = unwrapSubject(handed);
    return asSpecFunction(written) === null ? [] : [written];
  });

const anythingHandedBack = (specFunction: SpecFunction): readonly ESTree.Expression[] =>
  returnedExpressionsOf(specFunction).flatMap((handed) => heldFunctionsIn(handed));

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

const boundNameOf = (declaredId: ESTree.VariableDeclarator["id"], source: string): string =>
  declaredId.type === "Identifier"
    ? declaredId.name
    : source.slice(declaredId.start, declaredId.end);

type BindingReading = {
  readonly lookup: ScopeLookup;
  readonly source: string;
};

const bindingReportOf = (
  declarator: ESTree.VariableDeclarator,
  reading: BindingReading,
): NamedReport | null => {
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

const bindingReportsIn = (read: {
  readonly program: ESTree.Program;
  readonly reading: ScopeReading;
  readonly binding: BindingReading;
}): readonly NamedReport[] =>
  nodesOfType(read.program, "VariableDeclarator")
    .filter((declarator) => standsInHelperScope(declarator, read.reading))
    .flatMap((declarator) => bindingReportOf(declarator, read.binding) ?? []);

const fixtureBindingReportOf = (
  declarator: ESTree.VariableDeclarator,
  source: string,
): NamedReport | null => {
  const { init } = declarator;
  if (init === null) return null;

  const written = unwrapSubject(init);
  if (written.type !== "CallExpression") return null;
  if (fixtureDeclarationsOf(written).length === 0) return null;

  return {
    node: declarator,
    messageId: "moduleScopeFixtureBinding",
    data: { name: boundNameOf(declarator.id, source) },
  };
};

const standsAtModuleScope = (held: ESTree.Node, reading: ScopeReading): boolean =>
  innermostHolderOf(held, reading.functions) === null;

const fixtureBindingReportsIn = (read: {
  readonly program: ESTree.Program;
  readonly reading: ScopeReading;
  readonly binding: BindingReading;
}): readonly NamedReport[] =>
  nodesOfType(read.program, "VariableDeclarator")
    .filter((declarator) => standsAtModuleScope(declarator, read.reading))
    .flatMap((declarator) => fixtureBindingReportOf(declarator, read.binding.source) ?? []);

export const noSpecFileHelperFunction = createDontReviewItRule({
  name: "no-spec-file-helper-function--inline-or-use-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a helper function standing at module scope or in the body of a grouping block of a spec file, a fixture builder standing at module scope, and a fixture handing back a function written in place, so the block that names a behaviour also spells out the work that behaviour runs",
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
      moduleScopeFixtureBinding:
        "A fixture builder must not stand at module scope. Move `{{name}}` into the body of the grouping block whose test blocks read it, so the block that names a behaviour also stands beside the subject it reads. A builder derived from another builder and a builder carrying several fixtures are read the same way.",
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
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const binding: BindingReading = {
      lookup: (node) => inspection.sourceCode.getScope(node),
      source: inspection.sourceCode.text,
    };

    return {
      "Program:exit"(program: ESTree.Program) {
        const reading = scopeReadingIn(program, groupingBlockRootNames(program));
        const reports = [
          ...declarationReportsIn(program, reading),
          ...bindingReportsIn({ program, reading, binding }),
          ...fixtureBindingReportsIn({ program, reading, binding }),
          ...nodesOfType(program, "CallExpression").flatMap((call) => fixtureReportsOf(call)),
        ];

        for (const report of reports) inspection.report(report);
      },
    };
  },
});
