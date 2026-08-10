import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  annotatedDeclarationRanges,
  isInsideAnnotatedDeclaration,
  type AnnotatedDeclarationRange,
} from "../lib/canonical-values/annotated-declaration.ts";
import {
  canonicalValueKey,
  type CanonicalValuesCatalog,
  type CanonicalValuesEntry,
} from "../lib/canonical-values/catalog.ts";
import { declaresConceptAt } from "../lib/canonical-values/declaration-path.ts";
import {
  ancestorsOf,
  isKeySelectorArgument,
  isModuleSyntaxPosition,
  isStructuralKeyPosition,
  literalValue,
  negatedNumericValue,
  templateLiteralValue,
  type LiteralNode,
} from "../lib/canonical-values/literal-position.ts";
import {
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../lib/canonical-values/ownership-policy.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";

import type { ESTree, Visitor } from "@oxlint/plugins";
import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";

type LintedSource = {
  readonly program: ESTree.Program;
  readonly sourceText: string;
  readonly filename: string;
};

const registeredDeclarationRanges = (
  { program, sourceText, filename }: LintedSource,
  catalog: CanonicalValuesCatalog,
): readonly AnnotatedDeclarationRange[] =>
  annotatedDeclarationRanges(program, sourceText).filter((range) =>
    declaresConceptAt(catalog, { conceptId: range.conceptId, path: filename }),
  );

const conceptSummary = (entries: readonly CanonicalValuesEntry[]): string =>
  entries
    .map((entry) =>
      entry.exportPath === null
        ? `${entry.conceptId} declared in ${entry.declarationPath}`
        : `${entry.conceptId} exported from ${entry.exportPath}`,
    )
    .toSorted()
    .join("; ");

export const createNoStrictCanonicalLiteralUseRule = ({
  loadCatalog,
}: {
  readonly loadCatalog: CanonicalValuesCatalogLoader;
}) =>
  createDontReviewItRule({
    name: "no-strict-canonical-literal-use--use-canonical-import",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow writing a value that a declared vocabulary already owns as a literal, so every use site derives its spelling from the one place that declares it",
        relatedGuidelines: [],
      },
      messages: {
        canonicalValueLiteral:
          "A value that a declared vocabulary already owns must not be written again as a literal, because the literal and the declaration then change apart and nothing fails when they diverge. Replace {{value}} with the binding its owner publishes: {{concepts}}. Ownership policy: {{ownershipPolicy}}.",
      },
      schema: OWNERSHIP_POLICY_SCHEMA,
    },
    create(context): Visitor {
      if (isOutOfScopeSource(context.filename)) return {};

      const ownershipPolicy = ownershipPolicyOf(context.options);
      const loadedCatalog = memoize(
        (): CanonicalValuesCatalog =>
          loadCatalog({ repositoryRoot: findWorkspaceRoot(context.cwd) }),
      );
      const lintedSource: LintedSource = {
        program: context.sourceCode.ast,
        sourceText: context.sourceCode.text,
        filename: context.filename,
      };
      const exemptRangesOf = memoize(
        (loaded: CanonicalValuesCatalog): readonly AnnotatedDeclarationRange[] =>
          registeredDeclarationRanges(lintedSource, loaded),
      );

      const inspect = ({
        node,
        spelling,
        ancestors,
      }: {
        readonly node: ESTree.Node;
        readonly spelling: CanonicalValue;
        readonly ancestors: readonly ESTree.Node[];
      }): void => {
        const parent = ancestors.at(-1);
        if (parent !== undefined && isStructuralKeyPosition(parent, node)) return;
        if (parent !== undefined && isModuleSyntaxPosition(parent, node)) return;
        if (isKeySelectorArgument(ancestors)) return;

        const loaded = loadedCatalog();
        const entries = loaded.entriesByValue.get(canonicalValueKey(spelling));
        if (entries === undefined || entries.length === 0) return;

        if (isInsideAnnotatedDeclaration(exemptRangesOf(loaded), node)) return;

        context.report({
          node,
          messageId: "canonicalValueLiteral",
          data: {
            value: context.sourceCode.getText(node),
            concepts: conceptSummary(entries),
            ownershipPolicy,
          },
        });
      };

      return {
        Literal(node: LiteralNode) {
          const spelling = literalValue(node);
          if (spelling === null) return;
          const { parent } = node;
          if (
            typeof spelling === "number" &&
            parent.type === "UnaryExpression" &&
            parent.operator === "-"
          ) {
            return;
          }
          inspect({ node, spelling, ancestors: ancestorsOf(node) });
        },
        TemplateLiteral(node: ESTree.TemplateLiteral) {
          const spelling = templateLiteralValue(node);
          if (spelling === null) return;
          inspect({ node, spelling, ancestors: ancestorsOf(node) });
        },
        UnaryExpression(node: ESTree.UnaryExpression) {
          const spelling = negatedNumericValue(node);
          if (spelling === null) return;
          inspect({ node, spelling, ancestors: ancestorsOf(node) });
        },
      };
    },
  });
