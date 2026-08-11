import { assertionEntryCallOf } from "../spec-syntax/assertion-entries.ts";
import { handedValues } from "../spec-syntax/expression-parts.ts";
import { unwrapSubject } from "../spec-syntax/subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

export type ComparedOperands = {
  readonly subject: ESTree.Expression;
  readonly expectations: readonly ESTree.Expression[];
};

const spreadOnlySource = (
  members: readonly (ESTree.Expression | ESTree.ObjectPropertyKind | ESTree.SpreadElement | null)[],
): ESTree.Expression | null => {
  const [only] = members;
  if (only === undefined || only === null || members.length !== 1) return null;
  return only.type === "SpreadElement" ? only.argument : null;
};

export const unwrapCopiedValue = (node: ESTree.Expression): ESTree.Expression => {
  const written = unwrapSubject(node);
  if (written.type === "ObjectExpression") {
    const copied = spreadOnlySource(written.properties);
    return copied === null ? written : unwrapCopiedValue(copied);
  }
  if (written.type !== "ArrayExpression") return written;

  const copied = spreadOnlySource(written.elements);
  return copied === null ? written : unwrapCopiedValue(copied);
};

export const comparedOperandsOf = (call: ESTree.CallExpression): ComparedOperands | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const entry = assertionEntryCallOf(callee.object);
  if (entry === null) return null;

  const [handed] = entry.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;
  return { subject: handed, expectations: handedValues(call.arguments) };
};
