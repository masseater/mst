import { zip } from "es-toolkit";

import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { resolveCanonicalValueBinaryPrimitive } from "./canonical-value-static-binary.ts";

import type { ESTree } from "@oxlint/plugins";

export type CanonicalValueStaticPrimitive = string | number | boolean | bigint | null | undefined;

export const canonicalValueStaticPrimitiveKey = (
  primitive: CanonicalValueStaticPrimitive,
): string => {
  if (primitive === undefined) return "undefined";
  if (primitive === null) return "null";
  if (typeof primitive === "number" && Object.is(primitive, -0)) return "number:-0";
  return `${typeof primitive}:${String(primitive)}`;
};

const templateQuasi = (quasi: ESTree.TemplateElement | undefined): string =>
  quasi?.value.cooked ?? quasi?.value.raw ?? "";

export const resolveCanonicalValueTemplatePrimitive = (input: {
  readonly expression: ESTree.TemplateLiteral;
  readonly resolve: (expression: ESTree.Expression) => CandidateSet<CanonicalValueStaticPrimitive>;
}): CandidateSet<CanonicalValueStaticPrimitive> =>
  zip(input.expression.expressions, input.expression.quasis.slice(1)).reduce<
    CandidateSet<CanonicalValueStaticPrimitive>
  >(
    (prefixes, [substitution, quasi]) =>
      flatMapCandidateSet(prefixes, {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: (prefix) =>
          flatMapCandidateSet(input.resolve(substitution), {
            candidateKey: canonicalValueStaticPrimitiveKey,
            mapCandidate: (primitive) =>
              closedCandidateSet(
                [`${String(prefix)}${String(primitive)}${templateQuasi(quasi)}`],
                canonicalValueStaticPrimitiveKey,
              ),
          }),
      }),
    closedCandidateSet(
      [templateQuasi(input.expression.quasis[0])],
      canonicalValueStaticPrimitiveKey,
    ),
  );

const directLiteralPrimitive = (
  expression: Extract<ESTree.Expression, { readonly type: "Literal" }>,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if ("regex" in expression) return unknownCandidateSet();
  const primitive = expression.value;
  return primitive === null ||
    typeof primitive === "string" ||
    typeof primitive === "number" ||
    typeof primitive === "boolean" ||
    typeof primitive === "bigint"
    ? closedCandidateSet([primitive], canonicalValueStaticPrimitiveKey)
    : unknownCandidateSet();
};

export const resolveCanonicalValueLiteralPrimitive = (
  expression: ESTree.Expression,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (expression.type === "Literal") return directLiteralPrimitive(expression);
  if (expression.type !== "TemplateLiteral" || expression.expressions.length !== 0) return null;
  return closedCandidateSet(
    [expression.quasis[0]?.value.cooked ?? expression.quasis[0]?.value.raw ?? ""],
    canonicalValueStaticPrimitiveKey,
  );
};

const negatePrimitive = (
  primitive: CanonicalValueStaticPrimitive,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  typeof primitive === "number" || typeof primitive === "bigint"
    ? closedCandidateSet([-primitive], canonicalValueStaticPrimitiveKey)
    : unknownCandidateSet();

const invertPrimitive = (
  primitive: CanonicalValueStaticPrimitive,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  typeof primitive === "number" || typeof primitive === "bigint"
    ? closedCandidateSet([~primitive], canonicalValueStaticPrimitiveKey)
    : unknownCandidateSet();

export const canonicalValueStaticPrimitiveIsTruthy = (
  primitive: CanonicalValueStaticPrimitive,
): boolean => {
  if (primitive === null || primitive === undefined) return false;
  if (typeof primitive === "boolean") return primitive;
  if (typeof primitive === "string") return primitive.length !== 0;
  if (typeof primitive === "bigint") return primitive !== 0n;
  return primitive !== 0 && !Number.isNaN(primitive);
};

const directUnaryPrimitive = (
  operator: ESTree.UnaryExpression["operator"],
  primitive: CanonicalValueStaticPrimitive,
): CanonicalValueStaticPrimitive | symbol => {
  if (operator === "typeof") return typeof primitive;
  if (operator === "void") return undefined;
  if (operator === "!") return !canonicalValueStaticPrimitiveIsTruthy(primitive);
  return operator === "+" && typeof primitive !== "bigint"
    ? Number(primitive)
    : Symbol.for("non-direct-static-unary");
};

export const resolveCanonicalValueUnaryPrimitive = (
  operator: ESTree.UnaryExpression["operator"],
  primitive: CanonicalValueStaticPrimitive,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const direct = directUnaryPrimitive(operator, primitive);
  if (typeof direct !== "symbol") {
    return closedCandidateSet([direct], canonicalValueStaticPrimitiveKey);
  }
  if (operator === "-") return negatePrimitive(primitive);
  if (operator === "~") return invertPrimitive(primitive);
  return unknownCandidateSet();
};

export const resolveCanonicalValueDirectStaticPrimitive = (
  rawExpression: ESTree.Expression,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const expression = unwrapExpression(rawExpression);
  const literal = resolveCanonicalValueLiteralPrimitive(expression);
  if (literal !== null) return literal;
  if (expression.type === "TemplateLiteral") {
    return resolveCanonicalValueTemplatePrimitive({
      expression,
      resolve: resolveCanonicalValueDirectStaticPrimitive,
    });
  }
  if (expression.type !== "BinaryExpression" || expression.left.type === "PrivateIdentifier") {
    return unknownCandidateSet();
  }
  return resolveCanonicalValueBinaryPrimitive({
    expression: expression as ESTree.BinaryExpression & { readonly left: ESTree.Expression },
    resolve: resolveCanonicalValueDirectStaticPrimitive,
  });
};
