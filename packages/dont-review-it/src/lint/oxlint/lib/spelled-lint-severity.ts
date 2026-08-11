import { staticMemberOf } from "./static-member.ts";

import type { ESTree } from "@oxlint/plugins";

const severityHeadOf = (value: ESTree.Expression): ESTree.Expression | null => {
  if (value.type !== "ArrayExpression") return value;
  const [first] = value.elements;
  if (first === undefined || first === null || first.type === "SpreadElement") return null;
  return first;
};

export const spelledSeverityOf = (value: ESTree.Expression): string | null => {
  const head = severityHeadOf(value);
  if (head === null) return null;
  if (head.type === "Literal" && typeof head.value === "string") return head.value.toLowerCase();
  if (head.type === "Literal" && typeof head.value === "number") return String(head.value);
  const member = staticMemberOf(head);
  return member === null ? null : member.name.toLowerCase();
};
