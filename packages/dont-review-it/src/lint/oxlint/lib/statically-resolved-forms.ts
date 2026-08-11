import { listedFieldsOf, nodeTypeOf, staticSpecifierOf } from "./setup-modules/coupling-edges.ts";

import type { AstFields } from "./ast-node.ts";

export const STATICALLY_RESOLVED_FORMS: readonly string[] = ["URL", "import.meta.resolve"];

const WRAPPED_FIELD_BY_TYPE: ReadonlyMap<string, string> = new Map([
  ["AwaitExpression", "argument"],
  ["ChainExpression", "expression"],
  ["ParenthesizedExpression", "expression"],
  ["TSAsExpression", "expression"],
  ["TSNonNullExpression", "expression"],
]);

const CALLED_TYPES: ReadonlySet<string> = new Set(["CallExpression", "NewExpression"]);

const spelledNameOf = (node: AstFields): string | null => {
  const type = nodeTypeOf(node);
  if (type === "Identifier") return String(node.name);
  if (type === "MetaProperty") return dottedNameOf([node.meta, node.property]);
  if (type !== "MemberExpression" || node.computed === true) return null;
  return dottedNameOf([node.object, node.property]);
};

const dottedNameOf = (parts: readonly unknown[]): string | null => {
  const spelled = parts.map((part) => spelledNameOf(part as AstFields));
  return spelled.includes(null) ? null : spelled.join(".");
};

const carriedInsideOf = (node: AstFields): AstFields | null => {
  const type = nodeTypeOf(node);
  const wrappedField = WRAPPED_FIELD_BY_TYPE.get(type);
  if (wrappedField !== undefined) return node[wrappedField] as AstFields;
  return type === "MemberExpression" ? (node.object as AstFields) : null;
};

const calledFormOf = (
  node: AstFields,
): { readonly head: string; readonly handed: readonly AstFields[] } | null => {
  const inside = carriedInsideOf(node);
  if (inside !== null) return calledFormOf(inside);
  if (!CALLED_TYPES.has(nodeTypeOf(node))) return null;

  const head = spelledNameOf(node.callee as AstFields);
  return head === null ? null : { head, handed: listedFieldsOf(node.arguments) };
};

export const namesStaticallyResolvedForm = ({
  node,
  forms,
  constants,
}: {
  readonly node: AstFields;
  readonly forms: ReadonlySet<string>;
  readonly constants: ReadonlyMap<string, string>;
}): boolean => {
  const called = calledFormOf(node);
  if (called === null || !forms.has(called.head)) return false;
  return called.handed.some((handed) => staticSpecifierOf(handed, constants) !== null);
};
