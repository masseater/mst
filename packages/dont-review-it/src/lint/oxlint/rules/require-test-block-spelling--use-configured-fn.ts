import { sortBy } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { optionsRecord } from "../lib/rule-options.ts";
import { FIXTURE_BUILDER_MEMBER } from "../lib/spec-syntax/fixture-declarations.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import {
  INJECTED_TEST_BLOCK_SPELLINGS,
  RUNNER_MODULES,
} from "../lib/spec-syntax/test-block-declarations.ts";
import { testBlockRootIdentifier } from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree, Options, Scope, Variable } from "@oxlint/plugins";

const CANONICAL_BLOCK_SPELLING = "it";

const BLOCK_SPELLING_OPTION = "blockSpelling";

const RUNNER_MODULES_OPTION = "runnerModules";

const blockSpellingFrom = (options: Readonly<Options>): string => {
  const configured = optionsRecord(options)?.[BLOCK_SPELLING_OPTION];
  return typeof configured === "string" ? configured : CANONICAL_BLOCK_SPELLING;
};

const runnerModulesFrom = (options: Readonly<Options>): readonly string[] => {
  const configured = optionsRecord(options)?.[RUNNER_MODULES_OPTION];
  return Array.isArray(configured) ? configured : RUNNER_MODULES;
};

const boundVariable = (scope: Scope | null, name: string): Variable | null => {
  if (scope === null) return null;
  return scope.set.get(name) ?? boundVariable(scope.upper, name);
};

const initializerOf = (variable: Variable): ESTree.Expression | null => {
  const initial = variable.references.find((reference) => reference.init);
  return initial === undefined ? null : initial.writeExpr;
};

const fixtureBuilderBase = (initializer: ESTree.Expression): ESTree.Expression | null => {
  const written = unwrapSubject(initializer);
  if (written.type !== "CallExpression") return null;

  const callee = unwrapSubject(written.callee);
  if (callee.type !== "MemberExpression") return null;
  return staticMemberName(callee) === FIXTURE_BUILDER_MEMBER ? callee.object : null;
};

const importedSpelling = (imported: ESTree.ModuleExportName): string =>
  imported.type === "Identifier" ? imported.name : imported.value;

const importedBlockNamesIn = (
  program: ESTree.Program,
  runnerModules: readonly string[],
): ReadonlySet<string> =>
  new Set(
    nodesOfType(program, "ImportDeclaration").flatMap((declaration) =>
      runnerModules.includes(declaration.source.value)
        ? declaration.specifiers.flatMap((specifier) =>
            specifier.type === "ImportSpecifier" &&
            INJECTED_TEST_BLOCK_SPELLINGS.has(importedSpelling(specifier.imported))
              ? [specifier.local.name]
              : [],
          )
        : [],
    ),
  );

const spanKey = (node: ESTree.Node): string => `${String(node.start)}:${String(node.end)}`;

const declaredRootsIn = (program: ESTree.Program): readonly ESTree.IdentifierReference[] => {
  const declared = [
    ...nodesOfType(program, "CallExpression").map((call) => call.callee),
    ...nodesOfType(program, "TaggedTemplateExpression").map((tagged) => tagged.tag),
  ].flatMap((expression) => {
    const root = testBlockRootIdentifier(expression);
    return root === null ? [] : [root];
  });

  return [
    ...new Map(
      sortBy(declared, ["start"]).map((root): readonly [string, ESTree.IdentifierReference] => [
        spanKey(root),
        root,
      ]),
    ).values(),
  ];
};

export const requireTestBlockSpelling = createDontReviewItRule({
  name: "require-test-block-spelling--use-configured-fn",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every test block declaration to be rooted at one configured spelling, so a scan of the test surface settles what an identifier means without reading the block behind it",
      relatedGuidelines: [],
    },
    messages: {
      foreignBlockSpelling:
        "A test block must not be declared through `{{written}}`. Rename the root of this declaration to `{{required}}`.",
      foreignBlockBinding:
        "A test block must not be declared through the binding `{{written}}`. Rename that binding to `{{required}}` at its declaration and at every reference to it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          blockSpelling: { type: "string" },
          runnerModules: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  create(context) {
    const required = blockSpellingFrom(context.options);
    const runnerModules = runnerModulesFrom(context.options);

    const runnerBlockKind = ({
      root,
      importedBlocks,
      seen,
    }: {
      readonly root: ESTree.IdentifierReference;
      readonly importedBlocks: ReadonlySet<string>;
      readonly seen: ReadonlySet<string>;
    }): "binding" | "injected" | null => {
      if (seen.has(root.name)) return null;
      if (importedBlocks.has(root.name)) return "binding";

      const variable = boundVariable(context.sourceCode.getScope(root), root.name);
      if (variable === null)
        return INJECTED_TEST_BLOCK_SPELLINGS.has(root.name) ? "injected" : null;

      const initializer = initializerOf(variable);
      if (initializer === null) return null;

      const derived = testBlockRootIdentifier(fixtureBuilderBase(initializer) ?? initializer);
      if (derived === null) return null;

      const reached = runnerBlockKind({
        root: derived,
        importedBlocks,
        seen: new Set([...seen, root.name]),
      });
      return reached === null ? null : "binding";
    };

    const reportRoot = (
      root: ESTree.IdentifierReference,
      importedBlocks: ReadonlySet<string>,
    ): void => {
      if (root.name === required) return;

      const kind = runnerBlockKind({ root, importedBlocks, seen: new Set() });
      if (kind === null) return;

      const report = { node: root, data: { written: root.name, required } };
      if (kind === "binding") {
        context.report({ ...report, messageId: "foreignBlockBinding" });
        return;
      }
      context.report({
        ...report,
        messageId: "foreignBlockSpelling",
        fix: (fixer) => fixer.replaceText(root, required),
      });
    };

    return {
      "Program:exit"(program: ESTree.Program) {
        const importedBlocks = importedBlockNamesIn(program, runnerModules);
        for (const root of declaredRootsIn(program)) reportRoot(root, importedBlocks);
      },
    };
  },
});
