import type { ESTree } from "@oxlint/plugins";

export const unwrapTransparentExpression = (node: ESTree.Expression): ESTree.Expression => {
  switch (node.type) {
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return unwrapTransparentExpression(node.expression);
    default:
      return node;
  }
};
