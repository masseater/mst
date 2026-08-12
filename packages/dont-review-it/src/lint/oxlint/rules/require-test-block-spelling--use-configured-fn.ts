import { createDontReviewItRule } from "../../../create-rule.ts";
import { FIXTURE_BUILDER_MEMBER } from "../lib/spec-syntax/fixture-declarations.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import { INJECTED_TEST_BLOCK_SPELLINGS } from "../lib/spec-syntax/test-block-declarations.ts";
import { testBlockRootIdentifier } from "../lib/spec-syntax/test-block-modifiers.ts";

import type { ESTree, Options, Scope, Variable } from "@oxlint/plugins";

const CANONICAL_BLOCK_SPELLING = "it";

const RUNNER_MODULES: readonly string[] = ["vitest", "vite-plus/test"];

const BLOCK_SPELLING_OPTION = "blockSpelling";

const RUNNER_MODULES_OPTION = "runnerModules";

const optionsRecord = (options: Readonly<Options>): Readonly<Record<string, unknown>> | null => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) return null;
  return first;
};

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

const spanKey = (node: ESTree.Node): string => `${String(node.start)}:${String(node.end)}`;

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
    const importedBlocks = new Set<string>();
    const declaredRoots = new Map<string, ESTree.IdentifierReference>();

    const runnerBlockKind = (
      root: ESTree.IdentifierReference,
      seen: ReadonlySet<string>,
    ): "binding" | "injected" | null => {
      if (seen.has(root.name)) return null;
      if (importedBlocks.has(root.name)) return "binding";

      const variable = boundVariable(context.sourceCode.getScope(root), root.name);
      if (variable === null)
        return INJECTED_TEST_BLOCK_SPELLINGS.has(root.name) ? "injected" : null;

      const initializer = initializerOf(variable);
      if (initializer === null) return null;

      const derived = testBlockRootIdentifier(fixtureBuilderBase(initializer) ?? initializer);
      if (derived === null) return null;
      return runnerBlockKind(derived, new Set([...seen, root.name])) === null ? null : "binding";
    };

    const reportRoot = (root: ESTree.IdentifierReference): void => {
      if (root.name === required) return;

      const kind = runnerBlockKind(root, new Set());
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

    const rememberRoot = (declared: ESTree.Expression): void => {
      const root = testBlockRootIdentifier(declared);
      if (root === null) return;
      declaredRoots.set(spanKey(root), root);
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (!runnerModules.includes(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          if (!INJECTED_TEST_BLOCK_SPELLINGS.has(importedSpelling(specifier.imported))) continue;
          importedBlocks.add(specifier.local.name);
        }
      },
      CallExpression(node: ESTree.CallExpression) {
        rememberRoot(node.callee);
      },
      TaggedTemplateExpression(node: ESTree.TaggedTemplateExpression) {
        rememberRoot(node.tag);
      },
      "Program:exit"() {
        for (const root of declaredRoots.values()) reportRoot(root);
      },
    };
  },
});
