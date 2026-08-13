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

const literalSpelling = (literal: unknown): CanonicalValue | undefined => {
  if (literal === null) return null;
  return typeof literal === "string" || typeof literal === "number" || typeof literal === "boolean"
    ? literal
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
  const canonicalItems = node.elements.map((arrayElement) =>
    arrayElement === null || arrayElement.type === "SpreadElement"
      ? undefined
      : scalarLiteralValue(arrayElement),
  );
  return canonicalItems.every((canonicalItem) => canonicalItem !== undefined)
    ? canonicalItems
    : null;
};

export const isFiniteVocabulary = (canonicalItems: readonly CanonicalValue[]): boolean => {
  const distinct = new Set(canonicalItems.map(canonicalValueKey));
  if (distinct.size < MIN_VOCABULARY_SIZE) return false;
  return !canonicalItems.every((canonicalItem) => typeof canonicalItem === "boolean");
};

const literalTypeValue = (node: ESTree.TSType): CanonicalValue | undefined => {
  const typeNode = unwrapType(node);
  if (typeNode.type === "TSLiteralType") return scalarLiteralValue(typeNode.literal);
  if (typeNode.type === "TSTemplateLiteralType")
    return templateSpelling(typeNode.quasis, typeNode.types);
  if (typeNode.type === "TSNullKeyword") return null;
  return undefined;
};

export const literalUnionValues = (node: ESTree.TSType): readonly CanonicalValue[] | null => {
  const typeNode = unwrapType(node);
  if (typeNode.type !== "TSUnionType") return null;

  const spellings = typeNode.types.map((member) => literalTypeValue(member));
  return spellings.every((spelling) => spelling !== undefined) ? spellings : null;
};

export const propertyKeyName = (propertyKey: ESTree.ObjectProperty["key"]): string | null => {
  if (propertyKey.type === "Identifier") return propertyKey.name;
  if (propertyKey.type === "Literal")
    return typeof propertyKey.value === "string" || typeof propertyKey.value === "number"
      ? String(propertyKey.value)
      : null;
  if (propertyKey.type === "TemplateLiteral") {
    const propertyName = templateSpelling(propertyKey.quasis, propertyKey.expressions);
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
  schemaMember: ESTree.ArrayExpression["elements"][number],
): CanonicalValue | undefined => {
  if (schemaMember?.type !== "CallExpression") return undefined;
  if (calleeMemberName(schemaMember.callee) !== SCHEMA_LITERAL_MEMBER) return undefined;
  const [literal] = schemaMember.arguments;
  return literal === undefined || literal.type === "SpreadElement"
    ? undefined
    : scalarLiteralValue(literal);
};

export const schemaUnionLiterals = (
  node: ESTree.CallExpression,
): { readonly values: readonly CanonicalValue[]; readonly node: ESTree.ArrayExpression } | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  const schemaMembers = unwrapExpression(argument);
  if (schemaMembers.type !== "ArrayExpression") return null;
  const canonicalItems = schemaMembers.elements.map(schemaLiteralArgumentValue);
  return canonicalItems.every((canonicalItem) => canonicalItem !== undefined)
    ? { values: canonicalItems, node: schemaMembers }
    : null;
};
