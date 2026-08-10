import type { ESTree } from "@oxlint/plugins";

export type StaticMember = {
  readonly object: ESTree.Expression;
  readonly name: string;
};

export const staticMemberOf = (expression: ESTree.Expression): StaticMember | null => {
  if (expression.type !== "MemberExpression") return null;
  if (expression.computed) return null;
  if (expression.property.type !== "Identifier") return null;
  return { object: expression.object, name: expression.property.name };
};
