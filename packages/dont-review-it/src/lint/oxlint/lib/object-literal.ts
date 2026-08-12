import type { ESTree, FixFn, SourceCode } from "@oxlint/plugins";

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

const endAfterHorizontalWhitespace = (source: string, start: number): number => {
  const suffix = source.slice(start);
  return source.length - suffix.replace(/^[\t ]*/u, "").length;
};

const trailingCommaRemovalRange = ({
  property,
  comma,
  sourceCode,
}: {
  readonly property: ESTree.ObjectProperty;
  readonly comma: ESTree.Token;
  readonly sourceCode: SourceCode;
}): [number, number] => {
  const afterComma = sourceCode.getTokenAfter(comma);
  const previous = sourceCode.getTokenBefore(property);
  if (afterComma?.value === "}" && previous?.value === ",") {
    return [previous.start, comma.end];
  }
  return [property.start, endAfterHorizontalWhitespace(sourceCode.getText(), comma.end)];
};

const objectPropertyRemovalRange = ({
  property,
  sourceCode,
}: {
  readonly property: ESTree.ObjectProperty;
  readonly sourceCode: SourceCode;
}): [number, number] => {
  const next = sourceCode.getTokenAfter(property);
  if (next?.value === ",") {
    return trailingCommaRemovalRange({ property, comma: next, sourceCode });
  }
  const previous = sourceCode.getTokenBefore(property);
  return previous?.value === ","
    ? [previous.start, property.end]
    : [property.start, endAfterHorizontalWhitespace(sourceCode.getText(), property.end)];
};

export const removeObjectPropertyFix =
  ({
    property,
    sourceCode,
  }: {
    readonly property: ESTree.ObjectProperty;
    readonly sourceCode: SourceCode;
  }): FixFn =>
  (fixer) =>
    fixer.removeRange(objectPropertyRemovalRange({ property, sourceCode }));
