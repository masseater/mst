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
  OWNERSHIP_POLICY_SCHEMA,
  ownershipPolicyOf,
} from "../lib/canonical-values/ownership-policy.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { isOutOfScopeSource } from "../lib/out-of-scope-source.ts";

import type { CanonicalValuesCatalogLoader } from "../lib/canonical-values/catalog-loader.ts";
import type { CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import type { ESTree, Visitor } from "@oxlint/plugins";

const KEY_SELECTION_TYPE_NAMES: ReadonlySet<string> = new Set(["Omit", "Pick"]);

type LiteralNode =
  | ESTree.BigIntLiteral
  | ESTree.BooleanLiteral
  | ESTree.NullLiteral
  | ESTree.NumericLiteral
  | ESTree.RegExpLiteral
  | ESTree.StringLiteral;

const ancestorsOf = (node: ESTree.Node): readonly ESTree.Node[] =>
  node.parent === null ? [] : [...ancestorsOf(node.parent), node.parent];

const literalValue = (node: LiteralNode): CanonicalValue | null => {
  const spelling = node.value;
  if (
    typeof spelling === "string" ||
    typeof spelling === "number" ||
    typeof spelling === "boolean"
  ) {
    return spelling;
  }
  return null;
};

const negatedNumericValue = (node: ESTree.UnaryExpression): CanonicalValue | null => {
  if (node.operator !== "-") return null;
  const { argument } = node;
  if (argument.type !== "Literal") return null;
  return typeof argument.value === "number" ? -argument.value : null;
};

const templateLiteralValue = (node: ESTree.TemplateLiteral): CanonicalValue | null => {
  if (node.expressions.length !== 0 || node.quasis.length !== 1) return null;
  return node.quasis[0].value.cooked;
};

const isValueMemberKeyPosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "AccessorProperty":
    case "MethodDefinition":
    case "Property":
    case "PropertyDefinition":
      return !parent.computed && parent.key === node;
    default:
      return null;
  }
};

const isTypeMemberKeyPosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "TSAbstractAccessorProperty":
    case "TSAbstractMethodDefinition":
    case "TSAbstractPropertyDefinition":
    case "TSMethodSignature":
    case "TSPropertySignature":
      return !parent.computed && parent.key === node;
    default:
      return null;
  }
};

const isStructuralKeyPosition = (parent: ESTree.Node, node: ESTree.Node): boolean =>
  isValueMemberKeyPosition(parent, node) ??
  isTypeMemberKeyPosition(parent, node) ??
  (parent.type === "TSEnumMember" && parent.id === node);

const isModuleSourcePosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "ExportNamedDeclaration":
    case "ImportDeclaration":
    case "ImportExpression":
    case "TSImportType":
      return parent.source === node;
    case "ExportAllDeclaration":
      return parent.source === node || parent.exported === node;
    default:
      return null;
  }
};

const isModuleNamePosition = (parent: ESTree.Node, node: ESTree.Node): boolean | null => {
  switch (parent.type) {
    case "ImportAttribute":
      return parent.key === node || parent.value === node;
    case "ImportSpecifier":
      return parent.imported === node;
    case "ExportSpecifier":
      return parent.local === node || parent.exported === node;
    case "TSModuleDeclaration":
      return parent.id === node;
    default:
      return null;
  }
};

const isModuleSyntaxPosition = (parent: ESTree.Node, node: ESTree.Node): boolean =>
  isModuleSourcePosition(parent, node) ?? isModuleNamePosition(parent, node) ?? false;

const isKeySelectorArgument = (ancestors: readonly ESTree.Node[], node: ESTree.Node): boolean => {
  for (const [index, ancestor] of ancestors.entries()) {
    if (ancestor.type !== "TSTypeReference") continue;
    if (ancestor.typeName.type !== "Identifier") continue;
    if (!KEY_SELECTION_TYPE_NAMES.has(ancestor.typeName.name)) continue;
    if (index + 1 >= ancestors.length) continue;
    const instantiation = ancestors[index + 1];
    if (instantiation.type !== "TSTypeParameterInstantiation") continue;
    const selector = index + 2 < ancestors.length ? ancestors[index + 2] : node;
    if (instantiation.params[1] === selector) return true;
  }
  return false;
};

const registeredDeclarationRanges = (
  program: ESTree.Program,
  sourceText: string,
  catalog: CanonicalValuesCatalog,
  filename: string,
): readonly AnnotatedDeclarationRange[] =>
  annotatedDeclarationRanges(program, sourceText).filter((range) =>
    declaresConceptAt(catalog, range.conceptId, filename),
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
      const exemptRangesOf = memoize(
        (loaded: CanonicalValuesCatalog): readonly AnnotatedDeclarationRange[] =>
          registeredDeclarationRanges(
            context.sourceCode.ast,
            context.sourceCode.text,
            loaded,
            context.filename,
          ),
      );

      const inspect = (
        node: ESTree.Node,
        spelling: CanonicalValue,
        ancestors: readonly ESTree.Node[],
      ): void => {
        const parent = ancestors.at(-1);
        if (parent !== undefined && isStructuralKeyPosition(parent, node)) return;
        if (parent !== undefined && isModuleSyntaxPosition(parent, node)) return;
        if (isKeySelectorArgument(ancestors, node)) return;

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
          inspect(node, spelling, ancestorsOf(node));
        },
        TemplateLiteral(node: ESTree.TemplateLiteral) {
          const spelling = templateLiteralValue(node);
          if (spelling === null) return;
          inspect(node, spelling, ancestorsOf(node));
        },
        UnaryExpression(node: ESTree.UnaryExpression) {
          const spelling = negatedNumericValue(node);
          if (spelling === null) return;
          inspect(node, spelling, ancestorsOf(node));
        },
      };
    },
  });
