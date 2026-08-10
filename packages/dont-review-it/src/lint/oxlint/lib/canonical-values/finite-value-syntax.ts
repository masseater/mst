import { canonicalValueKey } from "./fingerprint.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValue } from "./fingerprint.ts";

const MIN_VOCABULARY_SIZE = 2;

export const SCHEMA_ENUM_MEMBERS: ReadonlySet<string> = new Set(["enum", "picklist"]);
export const SCHEMA_UNION_MEMBER = "union";
export const JSON_SCHEMA_ENUM_KEY = "enum";
export const SET_CONSTRUCTOR = "Set";

const SCHEMA_LITERAL_MEMBER = "literal";

export const unwrapExpression = (node: ESTree.Expression): ESTree.Expression => {
  if (node.type === "TSAsExpression") return unwrapExpression(node.expression);
  if (node.type === "TSSatisfiesExpression") return unwrapExpression(node.expression);
  if (node.type === "TSTypeAssertion") return unwrapExpression(node.expression);
  if (node.type === "ParenthesizedExpression") return unwrapExpression(node.expression);
  return node;
};

export const unwrapType = (node: ESTree.TSType): ESTree.TSType =>
  node.type === "TSParenthesizedType" ? unwrapType(node.typeAnnotation) : node;

const templateSpelling = (
  quasis: readonly ESTree.TemplateElement[],
  substitutions: readonly unknown[],
): CanonicalValue | null =>
  substitutions.length === 0 && quasis.length === 1 ? quasis[0].value.cooked : null;

const scalarLiteralValue = (node: ESTree.Expression): CanonicalValue | null => {
  const expression = unwrapExpression(node);
  if (expression.type === "Literal") {
    const { value } = expression;
    if (typeof value === "string") return value;
    if (typeof value === "number") return value;
    if (typeof value === "boolean") return value;
    return null;
  }
  if (expression.type === "TemplateLiteral") {
    return templateSpelling(expression.quasis, expression.expressions);
  }
  if (expression.type === "UnaryExpression" && expression.operator === "-") {
    const argument = scalarLiteralValue(expression.argument);
    return typeof argument === "number" ? -argument : null;
  }
  return null;
};

export const staticArrayValues = (
  node: ESTree.ArrayExpression,
): readonly CanonicalValue[] | null => {
  const vocabulary: CanonicalValue[] = [];
  for (const element of node.elements) {
    if (element === null || element.type === "SpreadElement") return null;
    const spelling = scalarLiteralValue(element);
    if (spelling === null) return null;
    vocabulary.push(spelling);
  }
  return vocabulary;
};

export const isFiniteVocabulary = (values: readonly CanonicalValue[]): boolean => {
  const distinct = new Set(values.map(canonicalValueKey));
  if (distinct.size < MIN_VOCABULARY_SIZE) return false;
  return !values.every((value) => typeof value === "boolean");
};

const literalTypeValue = (node: ESTree.TSType): CanonicalValue | null => {
  const type = unwrapType(node);
  if (type.type === "TSLiteralType") return scalarLiteralValue(type.literal);
  if (type.type === "TSTemplateLiteralType") return templateSpelling(type.quasis, type.types);
  return null;
};

export const literalUnionValues = (node: ESTree.TSType): readonly CanonicalValue[] | null => {
  const type = unwrapType(node);
  if (type.type !== "TSUnionType") return null;
  const vocabulary: CanonicalValue[] = [];
  for (const member of type.types) {
    const unwrapped = unwrapType(member);
    if (unwrapped.type === "TSNullKeyword") continue;
    if (unwrapped.type === "TSUndefinedKeyword") continue;
    const spelling = literalTypeValue(unwrapped);
    if (spelling === null) return null;
    vocabulary.push(spelling);
  }
  return vocabulary;
};

export const calleeMemberName = (node: ESTree.Expression): string | null => {
  const callee = unwrapExpression(node);
  if (callee.type !== "MemberExpression") return null;
  if (callee.computed) return null;
  return callee.property.type === "Identifier" ? callee.property.name : null;
};

export const propertyKeyName = (key: ESTree.ObjectProperty["key"]): string | null => {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
};

export type SchemaUnionLiterals = {
  readonly values: readonly CanonicalValue[];
  readonly node: ESTree.ArrayExpression;
};

export const schemaUnionLiterals = (node: ESTree.CallExpression): SchemaUnionLiterals | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  const array = unwrapExpression(argument);
  if (array.type !== "ArrayExpression") return null;

  const vocabulary: CanonicalValue[] = [];
  for (const element of array.elements) {
    if (element === null || element.type === "SpreadElement") return null;
    const call = unwrapExpression(element);
    if (call.type !== "CallExpression") return null;
    if (calleeMemberName(call.callee) !== SCHEMA_LITERAL_MEMBER) return null;
    const [literal] = call.arguments;
    if (literal === undefined || literal.type === "SpreadElement") return null;
    const spelling = scalarLiteralValue(literal);
    if (spelling === null) return null;
    vocabulary.push(spelling);
  }
  return { values: vocabulary, node: array };
};
