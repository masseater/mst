import type { ESTree } from "@oxlint/plugins";

export const withoutParentheses = (expression: ESTree.Expression): ESTree.Expression =>
  expression.type === "ParenthesizedExpression"
    ? withoutParentheses(expression.expression)
    : expression;
