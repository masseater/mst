import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";

const INVALID_BINARY_PRIMITIVE = Symbol("invalid-binary-primitive");

const BIGINT_EVALUATORS: Readonly<Record<string, (left: bigint, right: bigint) => bigint>> = {
  "%": (left, right) => left % right,
  "&": (left, right) => left & right,
  "*": (left, right) => left * right,
  "**": (left, right) => left ** right,
  "-": (left, right) => left - right,
  "/": (left, right) => left / right,
  "<<": (left, right) => left << right,
  ">>": (left, right) => left >> right,
  "^": (left, right) => left ^ right,
  "|": (left, right) => left | right,
};

const bigintPrimitive = (input: {
  readonly left: bigint;
  readonly operator: ESTree.BinaryExpression["operator"];
  readonly right: bigint;
}): CanonicalValueStaticPrimitive | symbol => {
  const evaluator = BIGINT_EVALUATORS[input.operator];
  return evaluator === undefined ? INVALID_BINARY_PRIMITIVE : evaluator(input.left, input.right);
};

const NUMBER_EVALUATORS: Readonly<Record<string, (left: number, right: number) => number>> = {
  "%": (left, right) => left % right,
  "&": (left, right) => left & right,
  "*": (left, right) => left * right,
  "**": (left, right) => left ** right,
  "-": (left, right) => left - right,
  "/": (left, right) => left / right,
  "<<": (left, right) => left << right,
  ">>": (left, right) => left >> right,
  ">>>": (left, right) => left >>> right,
  "^": (left, right) => left ^ right,
  "|": (left, right) => left | right,
};

const numberPrimitive = (input: {
  readonly left: CanonicalValueStaticPrimitive;
  readonly operator: ESTree.BinaryExpression["operator"];
  readonly right: CanonicalValueStaticPrimitive;
}): CanonicalValueStaticPrimitive | symbol => {
  const left = Number(input.left);
  const right = Number(input.right);
  const evaluator = NUMBER_EVALUATORS[input.operator];
  return evaluator === undefined ? INVALID_BINARY_PRIMITIVE : evaluator(left, right);
};

const addedPrimitive = (
  left: CanonicalValueStaticPrimitive,
  right: CanonicalValueStaticPrimitive,
): CanonicalValueStaticPrimitive | symbol => {
  if (typeof left === "string" || typeof right === "string")
    return `${String(left)}${String(right)}`;
  if (typeof left === "bigint" || typeof right === "bigint") {
    return typeof left === "bigint" && typeof right === "bigint"
      ? left + right
      : INVALID_BINARY_PRIMITIVE;
  }
  return Number(left) + Number(right);
};

const comparePrimitive = <Primitive extends bigint | number | string>(input: {
  readonly left: Primitive;
  readonly operator: ESTree.BinaryExpression["operator"];
  readonly right: Primitive;
}): boolean => {
  if (input.operator === "<") return input.left < input.right;
  if (input.operator === "<=") return input.left <= input.right;
  if (input.operator === ">") return input.left > input.right;
  return input.left >= input.right;
};

const relationalPrimitive = (input: {
  readonly left: CanonicalValueStaticPrimitive;
  readonly operator: ESTree.BinaryExpression["operator"];
  readonly right: CanonicalValueStaticPrimitive;
}): boolean | symbol => {
  if (typeof input.left === "bigint" || typeof input.right === "bigint") {
    if (typeof input.left !== "bigint" || typeof input.right !== "bigint") {
      return INVALID_BINARY_PRIMITIVE;
    }
    return comparePrimitive({ ...input, left: input.left, right: input.right });
  }
  if (typeof input.left === "string" && typeof input.right === "string") {
    return comparePrimitive({ ...input, left: input.left, right: input.right });
  }
  return comparePrimitive({ ...input, left: Number(input.left), right: Number(input.right) });
};

const isRelationalOperator = (
  operator: ESTree.BinaryExpression["operator"],
): operator is "<" | "<=" | ">" | ">=" =>
  operator === "<" || operator === "<=" || operator === ">" || operator === ">=";

const binaryPrimitive = (input: {
  readonly left: CanonicalValueStaticPrimitive;
  readonly operator: ESTree.BinaryExpression["operator"];
  readonly right: CanonicalValueStaticPrimitive;
}): CanonicalValueStaticPrimitive | symbol => {
  if (input.operator === "+") return addedPrimitive(input.left, input.right);
  if (input.operator === "===") return input.left === input.right;
  if (input.operator === "!==") return input.left !== input.right;
  if (isRelationalOperator(input.operator)) {
    return relationalPrimitive(input);
  }
  const leftIsBigInt = typeof input.left === "bigint";
  const rightIsBigInt = typeof input.right === "bigint";
  if (leftIsBigInt !== rightIsBigInt) return INVALID_BINARY_PRIMITIVE;
  return leftIsBigInt && rightIsBigInt
    ? bigintPrimitive({ left: input.left, operator: input.operator, right: input.right })
    : numberPrimitive(input);
};

const binaryCandidate = (input: {
  readonly left: CanonicalValueStaticPrimitive;
  readonly operator: ESTree.BinaryExpression["operator"];
  readonly right: CanonicalValueStaticPrimitive;
}): CandidateSet<CanonicalValueStaticPrimitive> => {
  try {
    const primitive = binaryPrimitive(input);
    return typeof primitive === "symbol"
      ? unknownCandidateSet()
      : closedCandidateSet([primitive], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) return unknownCandidateSet();
    throw error;
  }
};

export const resolveCanonicalValueBinaryPrimitive = (input: {
  readonly expression: ESTree.BinaryExpression & { readonly left: ESTree.Expression };
  readonly resolve: (expression: ESTree.Expression) => CandidateSet<CanonicalValueStaticPrimitive>;
}): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(input.resolve(input.expression.left), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (left) =>
      flatMapCandidateSet(input.resolve(input.expression.right), {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: (right) =>
          binaryCandidate({ left, operator: input.expression.operator, right }),
      }),
  });
