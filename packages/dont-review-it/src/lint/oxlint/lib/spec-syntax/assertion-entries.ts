import { ASSERTION_CHAIN_MODIFIERS, DERIVED_ASSERTION_RECEIVERS } from "./matcher-vocabulary.ts";
import { staticMemberName } from "./static-names.ts";
import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

export const ASSERTION_ENTRY_NAME = "expect";

export const isAssertionEntryReference = (node: ESTree.Expression): boolean => {
  const receiver = unwrapSubject(node);
  return receiver.type === "Identifier" && receiver.name === ASSERTION_ENTRY_NAME;
};

export const isAssertionEntryCall = (call: ESTree.CallExpression): boolean => {
  const callee = unwrapSubject(call.callee);
  if (callee.type === "Identifier") return callee.name === ASSERTION_ENTRY_NAME;
  if (callee.type !== "MemberExpression") return false;
  if (!isAssertionEntryReference(callee.object)) return false;

  const member = staticMemberName(callee);
  return member !== null && DERIVED_ASSERTION_RECEIVERS.has(member);
};

export const assertionEntryCallOf = (node: ESTree.Expression): ESTree.CallExpression | null => {
  const written = unwrapSubject(node);
  if (written.type === "CallExpression") return isAssertionEntryCall(written) ? written : null;
  if (written.type !== "MemberExpression") return null;

  const member = staticMemberName(written);
  if (member === null || !ASSERTION_CHAIN_MODIFIERS.has(member)) return null;
  return assertionEntryCallOf(written.object);
};

export const isAssertionChain = (node: ESTree.Expression): boolean =>
  assertionEntryCallOf(node) !== null;

export const isAssertionCall = (call: ESTree.CallExpression): boolean => {
  const callee = unwrapSubject(call.callee);
  return callee.type === "MemberExpression" && isAssertionChain(callee.object);
};
