import type { ESTree } from "@oxlint/plugins";

export const canonicalValueFlowSources = (
  expression: ESTree.Expression,
): readonly ESTree.Expression[] | null => {
  if (expression.type === "ConditionalExpression") {
    return [expression.consequent, expression.alternate];
  }
  if (expression.type === "LogicalExpression") return [expression.left, expression.right];
  if (expression.type !== "SequenceExpression") return null;
  const last = expression.expressions.at(-1);
  return last === undefined ? [] : [last];
};
