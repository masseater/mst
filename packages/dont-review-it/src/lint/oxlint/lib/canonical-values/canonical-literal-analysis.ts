import { registeredDeclarationRanges } from "./annotated-declaration.ts";
import {
  canonicalValueKey,
  type CanonicalValuesCatalog,
  type CanonicalValuesEntry,
} from "./catalog.ts";
import {
  isKeySelectorArgument,
  isModuleSyntaxPosition,
  isStructuralKeyPosition,
  literalValue,
  negatedNumericValue,
  templateLiteralValue,
  type LiteralNode,
} from "./literal-position.ts";
import { sourceNodes } from "./source-analysis.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";
import type { CanonicalValue } from "./fingerprint.ts";

export type CanonicalLiteralDiagnostic = {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly node: ESTree.Node;
  readonly spelling: CanonicalValue;
};

const isLiteralNode = (node: ESTree.Node): node is LiteralNode => node.type === "Literal";

type LiteralCandidate = {
  readonly node: ESTree.Node;
  readonly spelling: CanonicalValue;
};

const literalCandidate = (
  node: LiteralNode,
  parent: ESTree.Node | undefined,
): LiteralCandidate | null => {
  const spelling = literalValue(node);
  if (spelling === null && node.value !== null) return null;
  const signedByParent =
    typeof spelling === "number" &&
    parent?.type === "UnaryExpression" &&
    (parent.operator === "+" || parent.operator === "-");
  return signedByParent ? null : { node, spelling };
};

const templateCandidate = (node: ESTree.TemplateLiteral): LiteralCandidate | null => {
  const spelling = templateLiteralValue(node);
  return spelling === null ? null : { node, spelling };
};

const unaryCandidate = (node: ESTree.UnaryExpression): LiteralCandidate | null => {
  const spelling = negatedNumericValue(node);
  return spelling === null ? null : { node, spelling };
};

const candidateAt = (input: {
  readonly ancestors: readonly ESTree.Node[];
  readonly node: ESTree.Node;
}): LiteralCandidate | null => {
  if (isLiteralNode(input.node)) return literalCandidate(input.node, input.ancestors.at(-1));
  if (input.node.type === "TemplateLiteral") return templateCandidate(input.node);
  if (input.node.type === "UnaryExpression") return unaryCandidate(input.node);
  return null;
};

const exemptPosition = (ancestors: readonly ESTree.Node[], node: ESTree.Node): boolean => {
  const parent = ancestors.at(-1);
  return (
    (parent !== undefined && isStructuralKeyPosition(parent, node)) ||
    (parent !== undefined && isModuleSyntaxPosition(parent, node)) ||
    isKeySelectorArgument(ancestors)
  );
};

const rangeContainsCandidate = (
  range: ReturnType<typeof registeredDeclarationRanges>[number],
  candidate: LiteralCandidate,
): boolean =>
  range.start <= candidate.node.start &&
  candidate.node.end <= range.end &&
  range.values.map(canonicalValueKey).includes(canonicalValueKey(candidate.spelling));

export const analyzeCanonicalLiterals = (input: {
  readonly catalog: CanonicalValuesCatalog;
  readonly filename: string;
  readonly repositoryRoot: string;
  readonly sourceCode: SourceCode;
}): readonly CanonicalLiteralDiagnostic[] => {
  const ranges = registeredDeclarationRanges({
    catalog: input.catalog,
    filename: input.filename,
    repositoryRoot: input.repositoryRoot,
    sourceText: input.sourceCode.text,
  });
  return sourceNodes(input.sourceCode).flatMap(({ ancestors, node }) => {
    const candidate = candidateAt({ ancestors, node });
    if (candidate === null || exemptPosition(ancestors, candidate.node)) return [];
    const entries = input.catalog.entriesByValue.get(canonicalValueKey(candidate.spelling)) ?? [];
    if (entries.length === 0) return [];
    if (ranges.some((range) => rangeContainsCandidate(range, candidate))) return [];
    return [{ entries, ...candidate }];
  });
};
