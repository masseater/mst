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

export const declaresTrueAt = (lookup: ObjectLookup): boolean => {
  const declared = objectValueOf(lookup);
  return declared?.type === "Literal" && declared.value === true;
};

export const nestedObjectAt = ({
  object,
  path,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly path: readonly string[];
}): ESTree.ObjectExpression | null =>
  path.reduce<ESTree.ObjectExpression | null>((reached, named) => {
    if (reached === null) return null;
    const nested = objectValueOf({ object: reached, key: named });
    return nested?.type === "ObjectExpression" ? nested : null;
  }, object);

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
  const precedingToken = sourceCode.getTokenBefore(property);
  if (afterComma?.value === "}" && precedingToken?.value === ",") {
    return [precedingToken.start, comma.end];
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
  const followingToken = sourceCode.getTokenAfter(property);
  if (followingToken?.value === ",") {
    return trailingCommaRemovalRange({ property, comma: followingToken, sourceCode });
  }
  const precedingToken = sourceCode.getTokenBefore(property);
  return precedingToken?.value === ","
    ? [precedingToken.start, property.end]
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
