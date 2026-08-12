import type { ESTree } from "@oxlint/plugins";

type ObjectLookup = {
  readonly object: ESTree.ObjectExpression;
  readonly key: string;
};

export const propertyKeyOf = (property: ESTree.ObjectProperty): string | null => {
  const { key } = property;
  if (key.type === "Literal") return String(key.value);
  return key.type === "Identifier" && !property.computed ? key.name : null;
};

export const objectPropertyOf = ({ object, key }: ObjectLookup): ESTree.ObjectProperty | null =>
  object.properties.findLast(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && propertyKeyOf(property) === key,
  ) ?? null;

export const objectValueOf = (lookup: ObjectLookup): ESTree.Expression | null => {
  const property = objectPropertyOf(lookup);
  return property === null ? null : property.value;
};
