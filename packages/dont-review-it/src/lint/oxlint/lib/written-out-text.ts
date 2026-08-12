import type { ESTree } from "@oxlint/plugins";

export const CONCATENATION_OPERATOR = "+";

export const hasWrittenOutText = (expression: ESTree.Expression): boolean => {
  const written = expression;

  if (written.type === "Literal") return typeof written.value === "string";
  if (written.type === "TemplateLiteral") {
    return (
      written.quasis.some((quasi) => quasi.value.raw !== "") ||
      written.expressions.some(hasWrittenOutText)
    );
  }
  if (written.type !== "BinaryExpression" || written.operator !== CONCATENATION_OPERATOR) {
    return false;
  }
  return hasWrittenOutText(written.left) || hasWrittenOutText(written.right);
};
