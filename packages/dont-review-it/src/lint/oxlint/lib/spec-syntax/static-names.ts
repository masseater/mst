import { unwrapExpression } from "../canonical-values/finite-value-syntax.ts";
import { unwrapSubject } from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

export const staticSpelling = (node: ESTree.Expression): string | null => {
  const written = unwrapExpression(node);
  if (written.type === "Literal") return typeof written.value === "string" ? written.value : null;
  if (written.type !== "TemplateLiteral") return null;

  const [onlyQuasi, ...trailingQuasis] = written.quasis;
  const substituted = trailingQuasis.length !== 0 || written.expressions.length !== 0;
  return onlyQuasi === undefined || substituted ? null : onlyQuasi.value.cooked;
};

const spelledOutKey = (named: ESTree.PropertyKey, computed: boolean): string | null => {
  if (named.type === "PrivateIdentifier") return null;
  if (named.type === "Identifier") return computed ? null : named.name;
  return staticSpelling(named);
};

export const staticPropertyName = (
  property: ESTree.ObjectProperty | ESTree.BindingProperty,
): string | null => spelledOutKey(property.key, property.computed);

export const staticMemberName = (node: ESTree.MemberExpression): string | null =>
  spelledOutKey(node.property, node.computed);

export const staticCalleeName = (call: ESTree.CallExpression): string | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type === "Identifier") return callee.name;
  return callee.type === "MemberExpression" ? staticMemberName(callee) : null;
};
