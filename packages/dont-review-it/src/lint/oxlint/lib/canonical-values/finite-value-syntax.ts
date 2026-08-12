import { canonicalValueKey, type CanonicalValue } from "./fingerprint.ts";

import type { ESTree } from "@oxlint/plugins";

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
  return node;
};

const templateSpelling = (
  quasis: readonly ESTree.TemplateElement[],
  substitutions: readonly unknown[],
): CanonicalValue | null =>
  substitutions.length === 0
    ? quasis
        .slice(0, 1)
        .map((quasi) => quasi.value.cooked)
        .join("")
    : null;

const literalSpelling = (candidate: unknown): CanonicalValue | null => {
  if (typeof candidate === "string") return candidate;
  if (typeof candidate === "number") return candidate;
  if (typeof candidate === "boolean") return candidate;
  return null;
};

const scalarLiteralValue = (node: ESTree.Expression): CanonicalValue | null => {
  const expression = unwrapExpression(node);
  if (expression.type === "Literal") return literalSpelling(expression.value);
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
  const spellings = node.elements.map((held) =>
    held === null || held.type === "SpreadElement" ? null : scalarLiteralValue(held),
  );
  return spellings.every((spelling) => spelling !== null) ? spellings : null;
};

export const isFiniteVocabulary = (vocabulary: readonly CanonicalValue[]): boolean => {
  const distinct = new Set(vocabulary.map(canonicalValueKey));
  if (distinct.size < MIN_VOCABULARY_SIZE) return false;
  return !vocabulary.every((held) => typeof held === "boolean");
};

const literalTypeValue = (written: ESTree.TSType): CanonicalValue | null => {
  if (written.type === "TSLiteralType") return scalarLiteralValue(written.literal);
  if (written.type === "TSTemplateLiteralType")
    return templateSpelling(written.quasis, written.types);
  return null;
};

export const literalUnionValues = (written: ESTree.TSType): readonly CanonicalValue[] | null => {
  if (written.type !== "TSUnionType") return null;

  const spellings = written.types
    .filter((member) => member.type !== "TSNullKeyword" && member.type !== "TSUndefinedKeyword")
    .map((member) => literalTypeValue(member));
  return spellings.every((spelling) => spelling !== null) ? spellings : null;
};

export const calleeMemberName = (node: ESTree.Expression): string | null => {
  const callee = unwrapExpression(node);
  if (callee.type !== "MemberExpression") return null;
  if (callee.computed) return null;
  return callee.property.type === "Identifier" ? callee.property.name : null;
};

export const propertyKeyName = (keyNode: ESTree.ObjectProperty["key"]): string | null => {
  if (keyNode.type === "Identifier") return keyNode.name;
  if (keyNode.type === "Literal" && typeof keyNode.value === "string") return keyNode.value;
  return null;
};

const schemaLiteralArgumentValue = (
  held: ESTree.ArrayExpression["elements"][number],
): CanonicalValue | null => {
  if (held === null || held.type === "SpreadElement") return null;

  const call = unwrapExpression(held);
  if (call.type !== "CallExpression") return null;
  if (calleeMemberName(call.callee) !== SCHEMA_LITERAL_MEMBER) return null;

  const [literal] = call.arguments;
  if (literal === undefined || literal.type === "SpreadElement") return null;
  return scalarLiteralValue(literal);
};

export const schemaUnionLiterals = (
  node: ESTree.CallExpression,
): { readonly values: readonly CanonicalValue[]; readonly node: ESTree.ArrayExpression } | null => {
  const [argument] = node.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  const arrayExpression = unwrapExpression(argument);
  if (arrayExpression.type !== "ArrayExpression") return null;

  const spellings = arrayExpression.elements.map((held) => schemaLiteralArgumentValue(held));
  if (!spellings.every((spelling) => spelling !== null)) return null;
  return { values: spellings, node: arrayExpression };
};
