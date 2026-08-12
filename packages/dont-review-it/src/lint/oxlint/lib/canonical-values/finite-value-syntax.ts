import { canonicalValueKey, type CanonicalValue } from "./fingerprint.ts";

import type { ESTree } from "@oxlint/plugins";

const MIN_VOCABULARY_SIZE = 2;

export const SCHEMA_ENUM_MEMBERS: ReadonlySet<string> = new Set(["enum", "picklist"]);
const SCHEMA_LITERAL_MEMBER = "literal";
export const SCHEMA_UNION_MEMBER = "union";
export const JSON_SCHEMA_ENUM_KEY = "enum";
export const SET_CONSTRUCTOR = "Set";

export const unwrapExpression = (node: ESTree.Expression): ESTree.Expression =>
  node.type === "TSAsExpression" ||
  node.type === "TSSatisfiesExpression" ||
  node.type === "TSTypeAssertion" ||
  node.type === "TSNonNullExpression" ||
  node.type === "ParenthesizedExpression" ||
  node.type === "ChainExpression"
    ? unwrapExpression(node.expression)
    : node;

export const unwrapType = (node: ESTree.TSType): ESTree.TSType =>
  node.type === "TSParenthesizedType" ? unwrapType(node.typeAnnotation) : node;

const templateSpelling = (
  quasis: readonly ESTree.TemplateElement[],
  substitutions: readonly unknown[],
): CanonicalValue | undefined => (substitutions.length === 0 ? quasis[0]?.value.cooked : undefined);

const literalSpelling = (value: unknown): CanonicalValue | undefined => {
  if (value === null) return null;
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : undefined;
};

const scalarLiteralValue = (node: ESTree.Expression): CanonicalValue | undefined => {
  const expression = unwrapExpression(node);
  if (expression.type === "Literal") return literalSpelling(expression.value);
  if (expression.type === "TemplateLiteral")
    return templateSpelling(expression.quasis, expression.expressions);
  if (
    expression.type === "UnaryExpression" &&
    (expression.operator === "+" || expression.operator === "-")
  ) {
    const argument = scalarLiteralValue(expression.argument);
    return typeof argument === "number"
      ? expression.operator === "-"
        ? -argument
        : argument
      : undefined;
  }
  return undefined;
};

export const staticArrayValues = (
  node: ESTree.ArrayExpression,
): readonly CanonicalValue[] | null => {
  const canonicalItems = node.elements.map((element) =>
    element === null || element.type === "SpreadElement" ? undefined : scalarLiteralValue(element),
  );
  return canonicalItems.every((canonicalItem) => canonicalItem !== undefined)
    ? canonicalItems
    : null;
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
  if (key.type === "Literal")
    return typeof key.value === "string" || typeof key.value === "number"
      ? String(key.value)
      : null;
  if (key.type === "TemplateLiteral") {
    const propertyName = templateSpelling(key.quasis, key.expressions);
    return typeof propertyName === "string" ? propertyName : null;
  }
  return null;
};

export const calleeMemberName = (node: ESTree.Expression): string | null => {
  const callee = unwrapExpression(node);
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  return (callee.property as ESTree.IdentifierName).name;
};

const schemaLiteralArgumentValue = (
  element: ESTree.ArrayExpression["elements"][number],
): CanonicalValue | undefined => {
  if (element?.type !== "CallExpression") return undefined;
  if (calleeMemberName(element.callee) !== SCHEMA_LITERAL_MEMBER) return undefined;
  const [literal] = element.arguments;
  return literal === undefined || literal.type === "SpreadElement"
    ? undefined
    : scalarLiteralValue(literal);
};

export const schemaUnionLiterals = (
  node: ESTree.CallExpression,
): { readonly values: readonly CanonicalValue[]; readonly node: ESTree.ArrayExpression } | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  const array = unwrapExpression(argument);
  if (array.type !== "ArrayExpression") return null;
  const canonicalItems = array.elements.map(schemaLiteralArgumentValue);
  return canonicalItems.every((canonicalItem) => canonicalItem !== undefined)
    ? { values: canonicalItems, node: array }
    : null;
};
