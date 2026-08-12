import { canonicalValueKey, type CanonicalValue } from "../lib/canonical-values/fingerprint.ts";
import { scalarLiteralValue, unwrapType } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  type CanonicalValuePrimitiveTypeEnvironment,
  type CanonicalValuePrimitiveTypeResolution,
} from "./canonical-value-primitive-type-context.ts";
import { resolveCanonicalValuePrimitiveTypeReference } from "./canonical-value-primitive-type-reference.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValueTypeRelation = boolean | null;

type CandidateMatchInput = CanonicalValuePrimitiveTypeResolution & {
  readonly candidate: CanonicalValue;
  readonly type: ESTree.TSType;
};

type TypeRelationInput = CanonicalValuePrimitiveTypeResolution & {
  readonly check: ESTree.TSType;
  readonly pattern: ESTree.TSType;
};

const keywordMatch = (candidate: CanonicalValue, type: ESTree.TSType): boolean | null => {
  if (type.type === "TSStringKeyword") return typeof candidate === "string";
  if (type.type === "TSNumberKeyword") return typeof candidate === "number";
  if (type.type === "TSBooleanKeyword") return typeof candidate === "boolean";
  if (type.type === "TSNullKeyword") return candidate === null;
  if (type.type === "TSNeverKeyword") return false;
  return type.type === "TSUnknownKeyword" || type.type === "TSAnyKeyword" ? true : null;
};

const combinedRelation = (
  relations: readonly CanonicalValueTypeRelation[],
  mode: "all" | "any",
): CanonicalValueTypeRelation => {
  if (mode === "all") {
    if (relations.includes(false)) return false;
    return relations.includes(null) ? null : true;
  }
  if (relations.includes(true)) return true;
  return relations.includes(null) ? null : false;
};

const literalMatch = (
  candidate: CanonicalValue,
  type: ESTree.TSType,
): CanonicalValueTypeRelation => {
  if (type.type !== "TSLiteralType") return null;
  const literal = scalarLiteralValue(type.literal);
  return literal === undefined ? null : canonicalValueKey(literal) === canonicalValueKey(candidate);
};

const compoundMatch = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CandidateMatchInput,
): CanonicalValueTypeRelation =>
  input.type.type === "TSUnionType" || input.type.type === "TSIntersectionType"
    ? combinedRelation(
        input.type.types.map((member) =>
          canonicalValuePrimitiveMatchesType(environment, { ...input, type: member }),
        ),
        input.type.type === "TSUnionType" ? "any" : "all",
      )
    : null;

const referencedMatch = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CandidateMatchInput,
): CanonicalValueTypeRelation => {
  if (input.type.type !== "TSTypeReference" || input.seenTypes.has(input.type)) return null;
  const referenced = resolveCanonicalValuePrimitiveTypeReference(environment, {
    ...input,
    seenTypes: new Set([...input.seenTypes, input.type]),
    type: input.type,
  });
  return referenced === null
    ? null
    : canonicalValuePrimitiveMatchesType(environment, {
        ...input,
        ...referenced,
        candidate: input.candidate,
      });
};

export const canonicalValuePrimitiveMatchesType = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: CandidateMatchInput,
): CanonicalValueTypeRelation => {
  const type = unwrapType(input.type);
  const normalized = { ...input, type };
  return (
    keywordMatch(input.candidate, type) ??
    literalMatch(input.candidate, type) ??
    compoundMatch(environment, normalized) ??
    referencedMatch(environment, normalized)
  );
};

const primitiveKeywordKind = (type: ESTree.TSType): string | null => {
  if (type.type === "TSStringKeyword") return "string";
  if (type.type === "TSNumberKeyword") return "number";
  if (type.type === "TSBooleanKeyword") return "boolean";
  if (type.type === "TSNullKeyword") return "null";
  return null;
};

const referencedTypeRelation = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: TypeRelationInput,
): CanonicalValueTypeRelation => {
  if (input.check.type === "TSTypeReference" && !input.seenTypes.has(input.check)) {
    const referenced = resolveCanonicalValuePrimitiveTypeReference(environment, {
      ...input,
      seenTypes: new Set([...input.seenTypes, input.check]),
      type: input.check,
    });
    if (referenced !== null) {
      return canonicalValuePrimitiveTypeRelation(environment, {
        ...input,
        ...referenced,
        check: referenced.type,
        pattern: input.pattern,
      });
    }
  }
  if (input.pattern.type !== "TSTypeReference" || input.seenTypes.has(input.pattern)) return null;
  const referenced = resolveCanonicalValuePrimitiveTypeReference(environment, {
    ...input,
    seenTypes: new Set([...input.seenTypes, input.pattern]),
    type: input.pattern,
  });
  return referenced === null
    ? null
    : canonicalValuePrimitiveTypeRelation(environment, {
        ...input,
        ...referenced,
        check: input.check,
        pattern: referenced.type,
      });
};

const literalTypeRelation = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: TypeRelationInput,
): CanonicalValueTypeRelation => {
  if (input.check.type !== "TSLiteralType") return null;
  const literal = scalarLiteralValue(input.check.literal);
  return literal === undefined
    ? null
    : canonicalValuePrimitiveMatchesType(environment, {
        ...input,
        candidate: literal,
        type: input.pattern,
      });
};

const compoundTypeRelation = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: TypeRelationInput,
): CanonicalValueTypeRelation => {
  if (input.check.type === "TSUnionType") {
    return combinedRelation(
      input.check.types.map((member) =>
        canonicalValuePrimitiveTypeRelation(environment, { ...input, check: member }),
      ),
      "all",
    );
  }
  if (input.pattern.type !== "TSUnionType" && input.pattern.type !== "TSIntersectionType") {
    return null;
  }
  return combinedRelation(
    input.pattern.types.map((member) =>
      canonicalValuePrimitiveTypeRelation(environment, { ...input, pattern: member }),
    ),
    input.pattern.type === "TSUnionType" ? "any" : "all",
  );
};

const directTypeRelation = (
  check: ESTree.TSType,
  pattern: ESTree.TSType,
): CanonicalValueTypeRelation => {
  if (pattern.type === "TSUnknownKeyword" || pattern.type === "TSAnyKeyword") return true;
  if (check.type === "TSNeverKeyword") return true;
  const checkKind = primitiveKeywordKind(check);
  const patternKind = primitiveKeywordKind(pattern);
  return checkKind === null || patternKind === null ? null : checkKind === patternKind;
};

export const canonicalValuePrimitiveTypeRelation = (
  environment: CanonicalValuePrimitiveTypeEnvironment,
  input: TypeRelationInput,
): CanonicalValueTypeRelation => {
  const check = unwrapType(input.check);
  const pattern = unwrapType(input.pattern);
  const normalized = { ...input, check, pattern };
  return (
    referencedTypeRelation(environment, normalized) ??
    literalTypeRelation(environment, normalized) ??
    compoundTypeRelation(environment, normalized) ??
    directTypeRelation(check, pattern)
  );
};
