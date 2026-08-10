import { withoutParentheses } from "./parenthesized-expression.ts";

import type { ESTree } from "@oxlint/plugins";

type ObjectLookup = {
  readonly object: ESTree.ObjectExpression;
  readonly key: string;
};

const propertyKeyOf = (property: ESTree.ObjectProperty): string | null => {
  if (property.computed) return null;
  const { key } = property;
  if (key.type === "Identifier") return key.name;
  if (key.type !== "Literal") return null;
  return typeof key.value === "string" || typeof key.value === "number" ? String(key.value) : null;
};

export const objectPropertyOf = ({ object, key }: ObjectLookup): ESTree.ObjectProperty | null =>
  object.properties.findLast(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && propertyKeyOf(property) === key,
  ) ?? null;

export const objectValueOf = (lookup: ObjectLookup): ESTree.Expression | null => {
  const property = objectPropertyOf(lookup);
  return property === null ? null : withoutParentheses(property.value);
};

export const nestedObjectAt = ({
  object,
  path,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly path: readonly string[];
}): ESTree.ObjectExpression | null =>
  path.reduce<ESTree.ObjectExpression | null>((current, key) => {
    if (current === null) return null;
    const nested = objectValueOf({ object: current, key });
    return nested !== null && nested.type === "ObjectExpression" ? nested : null;
  }, object);
