import { staticMemberOf } from "./static-member.ts";

import type { ESTree } from "@oxlint/plugins";

const severityHeadOf = (held: ESTree.Expression): ESTree.Expression | null => {
  if (held.type !== "ArrayExpression") return held;
  const [first] = held.elements;
  if (first === undefined || first === null || first.type === "SpreadElement") return null;
  return first;
};

export const spelledSeverityOf = (held: ESTree.Expression): string | null => {
  const head = severityHeadOf(held);
  if (head === null) return null;
  if (head.type === "Literal" && typeof head.value === "string") return head.value.toLowerCase();
  if (head.type === "Literal" && typeof head.value === "number") return String(head.value);
  const member = staticMemberOf(head);
  return member === null ? null : member.name.toLowerCase();
};
