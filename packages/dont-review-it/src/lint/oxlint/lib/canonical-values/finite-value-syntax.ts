import { canonicalValueKey, type CanonicalValue } from "./fingerprint.ts";

import type { ESTree } from "@oxlint/plugins";

const MIN_VOCABULARY_SIZE = 2;

export const SCHEMA_ENUM_MEMBERS: ReadonlySet<string> = new Set(["enum", "picklist"]);
export const SCHEMA_LITERAL_MEMBER = "literal";
export const SCHEMA_UNION_MEMBER = "union";
export const JSON_SCHEMA_ENUM_KEY = "enum";

export const unwrapExpression = (node: ESTree.Expression): ESTree.Expression => {
  if (node.type === "TSAsExpression") return unwrapExpression(node.expression);
  if (node.type === "TSSatisfiesExpression") return unwrapExpression(node.expression);
  if (node.type === "TSTypeAssertion") return unwrapExpression(node.expression);
  if (node.type === "TSNonNullExpression") return unwrapExpression(node.expression);
  if (node.type === "ParenthesizedExpression") return unwrapExpression(node.expression);
  if (node.type === "ChainExpression") return unwrapExpression(node.expression);
  return node;
};

export const unwrapType = (node: ESTree.TSType): ESTree.TSType =>
  node.type === "TSParenthesizedType" ? unwrapType(node.typeAnnotation) : node;

const templateSpelling = (
  quasis: readonly ESTree.TemplateElement[],
  substitutions: readonly unknown[],
): CanonicalValue | undefined =>
  substitutions.length === 0 && quasis.length === 1
    ? (quasis[0]?.value.cooked ?? undefined)
    : undefined;

const literalSpelling = (value: unknown): CanonicalValue | undefined => {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value;
  return undefined;
};

export const scalarLiteralValue = (node: ESTree.Expression): CanonicalValue | undefined => {
  const expression = unwrapExpression(node);
  if (expression.type === "Literal") return literalSpelling(expression.value);
  if (expression.type === "TemplateLiteral") {
    return templateSpelling(expression.quasis, expression.expressions);
  }
  if (
    expression.type === "UnaryExpression" &&
    (expression.operator === "+" || expression.operator === "-")
  ) {
    const argument = scalarLiteralValue(expression.argument);
    if (typeof argument !== "number") return undefined;
    return expression.operator === "-" ? -argument : argument;
  }
  return undefined;
};

export const isFiniteVocabulary = (values: readonly CanonicalValue[]): boolean => {
  const distinct = new Set(values.map(canonicalValueKey));
  if (distinct.size < MIN_VOCABULARY_SIZE) return false;
  return !values.every((value) => typeof value === "boolean");
};

const literalTypeValue = (node: ESTree.TSType): CanonicalValue | undefined => {
  const type = unwrapType(node);
  if (type.type === "TSLiteralType") return scalarLiteralValue(type.literal);
  if (type.type === "TSTemplateLiteralType") return templateSpelling(type.quasis, type.types);
  if (type.type === "TSNullKeyword") return null;
  return undefined;
};

export const literalUnionValues = (node: ESTree.TSType): readonly CanonicalValue[] | null => {
  const type = unwrapType(node);
  if (type.type !== "TSUnionType") return null;

  const spellings = type.types.map((member) => literalTypeValue(member));
  return spellings.every((spelling) => spelling !== undefined) ? spellings : null;
};

export const propertyKeyName = (key: ESTree.ObjectProperty["key"]): string | null => {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && (typeof key.value === "string" || typeof key.value === "number")) {
    return String(key.value);
  }
  if (key.type === "TemplateLiteral") {
    const propertyName = templateSpelling(key.quasis, key.expressions);
    return typeof propertyName === "string" ? propertyName : null;
  }
  return null;
};
