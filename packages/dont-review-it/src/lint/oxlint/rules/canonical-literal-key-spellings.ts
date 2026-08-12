import type { ESTree } from "@oxlint/plugins";
import type { CanonicalLiteralCandidate } from "./canonical-literal-candidate.ts";

const transparentChildOf = (node: ESTree.Node): ESTree.Node | null => {
  switch (node.type) {
    case "ChainExpression":
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return node.expression;
    default:
      return null;
  }
};

const computedKeyOf = (node: ESTree.Node): ESTree.Node | null => {
  if (!("computed" in node) || !node.computed) return null;
  if (node.type === "MemberExpression") return node.property;
  if (!("key" in node)) return null;
  const key = node.key;
  return typeof key === "object" && "type" in key ? key : null;
};

const candidateIsComputedKey = ({
  ancestors,
  node,
}: Pick<CanonicalLiteralCandidate, "ancestors" | "node">): boolean => {
  const parent = ancestors.at(-1);
  if (parent === undefined) return false;
  const transparentChild = transparentChildOf(parent);
  return transparentChild === node
    ? candidateIsComputedKey({ ancestors: ancestors.slice(0, -1), node: parent })
    : computedKeyOf(parent) === node;
};

export const canonicalLiteralLookupSpellings = (
  candidate: CanonicalLiteralCandidate,
): readonly CanonicalLiteralCandidate["spelling"][] =>
  candidateIsComputedKey(candidate) && typeof candidate.spelling !== "string"
    ? [candidate.spelling, String(candidate.spelling)]
    : [candidate.spelling];
