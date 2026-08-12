import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  resolveCanonicalValueStaticInvocationArgumentVectors,
  type CanonicalValueStaticPrimitiveEvaluator,
  type CanonicalValueStaticPrimitiveVector,
} from "./canonical-value-static-array.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import {
  type CanonicalValueStaticInvocationEnvironment,
  type CanonicalValueStaticInvocationInput,
  type CanonicalValueStaticResolutionContext,
} from "./canonical-value-static-invocation-types.ts";
import { resolveCanonicalValueStaticNumberStringInvocation } from "./canonical-value-static-number-string.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";

const bigIntValue = (arguments_: CanonicalValueStaticPrimitiveVector): bigint => {
  if (arguments_.length === 0) return 0n;
  const first = arguments_[0];
  if (first === null || first === undefined) throw new TypeError();
  return BigInt(first);
};

const PRIMITIVE_CONVERTERS: Readonly<Record<string, CanonicalValueStaticPrimitiveEvaluator>> = {
  BigInt: bigIntValue,
  Boolean: (arguments_: CanonicalValueStaticPrimitiveVector) => Boolean(arguments_[0]),
  Number: (arguments_: CanonicalValueStaticPrimitiveVector) =>
    arguments_.length === 0 ? 0 : Number(arguments_[0]),
  String: (arguments_: CanonicalValueStaticPrimitiveVector) =>
    arguments_.length === 0 ? "" : String(arguments_[0]),
};

const primitiveConstructor = (
  environment: CanonicalValueStaticInvocationEnvironment,
  fact: CanonicalValueInvocationFact,
): CanonicalValueStaticPrimitiveEvaluator | null => {
  for (const name of Object.keys(PRIMITIVE_CONVERTERS)) {
    const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
      name,
      origin: fact.target,
    });
    const converter = PRIMITIVE_CONVERTERS[name];
    if (path?.length === 0 && converter !== undefined) return converter;
  }
  return null;
};

const convertedPrimitive = (
  converter: CanonicalValueStaticPrimitiveEvaluator,
  arguments_: CanonicalValueStaticPrimitiveVector,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  try {
    return closedCandidateSet([converter(arguments_)], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError || error instanceof TypeError) {
      return unknownCandidateSet();
    }
    throw error;
  }
};

const primitiveConstruction = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly converter: CanonicalValueStaticPrimitiveEvaluator;
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (arguments_) => convertedPrimitive(input.converter, arguments_),
  });

const boxedPrimitive = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & { readonly expression: ESTree.NewExpression },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(environment.invocationState.facts(input.expression), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (fact) => {
      const converter = primitiveConstructor(environment, fact);
      return converter === null || converter === bigIntValue
        ? unknownCandidateSet()
        : primitiveConstruction(environment, { ...input, converter, fact });
    },
  });

const receiverPrimitives = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const receiver = input.fact.thisArgument;
  if (receiver === null) return unknownCandidateSet();
  const direct = input.resolve({ ...input.query, expression: receiver });
  return receiver.type === "NewExpression"
    ? joinCandidateSets(
        [direct, boxedPrimitive(environment, { ...input, expression: receiver })],
        canonicalValueStaticPrimitiveKey,
      )
    : direct;
};

const isValueOfTarget = (
  environment: CanonicalValueStaticInvocationEnvironment,
  fact: CanonicalValueInvocationFact,
): boolean => {
  const directPath = canonicalValueInvocationPropertyPath(fact.target);
  if (directPath?.length === 1 && directPath[0] === "valueOf") return true;
  for (const name of ["Boolean", "Number", "String"] as const) {
    const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
      name,
      origin: fact.target,
    });
    if (path?.length === 2 && path[0] === "prototype" && path[1] === "valueOf") return true;
  }
  return false;
};

const NUMBER_PARSERS: Readonly<Record<string, CanonicalValueStaticPrimitiveEvaluator>> = {
  parseFloat: (arguments_: CanonicalValueStaticPrimitiveVector) =>
    Number.parseFloat(String(arguments_[0])),
  parseInt: (arguments_: CanonicalValueStaticPrimitiveVector) =>
    Number.parseInt(
      String(arguments_[0]),
      arguments_[1] === undefined ? undefined : Number(arguments_[1]),
    ),
};

const parseMethod = (
  environment: CanonicalValueStaticInvocationEnvironment,
  fact: CanonicalValueInvocationFact,
): CanonicalValueStaticPrimitiveEvaluator | null => {
  for (const name of Object.keys(NUMBER_PARSERS)) {
    const parser = NUMBER_PARSERS[name];
    if (parser === undefined) continue;
    const globalPath = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
      name,
      origin: fact.target,
    });
    if (globalPath?.length === 0) return parser;
    const numberPath = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
      name: "Number",
      origin: fact.target,
    });
    if (numberPath?.length === 1 && numberPath[0] === name) return parser;
  }
  return null;
};

const parseConstruction = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly parser: CanonicalValueStaticPrimitiveEvaluator;
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  mapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: input.parser,
  });

const firstNumber = (arguments_: CanonicalValueStaticPrimitiveVector): number =>
  Number(arguments_[0]);

const numbers = (arguments_: CanonicalValueStaticPrimitiveVector): number[] =>
  arguments_.map(Number);

const STATIC_MATH_EVALUATORS: Readonly<Record<string, CanonicalValueStaticPrimitiveEvaluator>> = {
  abs: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.abs(firstNumber(arguments_)),
  acos: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.acos(firstNumber(arguments_)),
  acosh: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.acosh(firstNumber(arguments_)),
  asin: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.asin(firstNumber(arguments_)),
  asinh: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.asinh(firstNumber(arguments_)),
  atan: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.atan(firstNumber(arguments_)),
  atan2: (arguments_: CanonicalValueStaticPrimitiveVector) =>
    Math.atan2(Number(arguments_[0]), Number(arguments_[1])),
  atanh: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.atanh(firstNumber(arguments_)),
  cbrt: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.cbrt(firstNumber(arguments_)),
  ceil: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.ceil(firstNumber(arguments_)),
  clz32: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.clz32(firstNumber(arguments_)),
  cos: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.cos(firstNumber(arguments_)),
  cosh: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.cosh(firstNumber(arguments_)),
  exp: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.exp(firstNumber(arguments_)),
  expm1: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.expm1(firstNumber(arguments_)),
  floor: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.floor(firstNumber(arguments_)),
  fround: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.fround(firstNumber(arguments_)),
  hypot: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.hypot(...numbers(arguments_)),
  imul: (arguments_: CanonicalValueStaticPrimitiveVector) =>
    Math.imul(Number(arguments_[0]), Number(arguments_[1])),
  log: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.log(firstNumber(arguments_)),
  log10: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.log10(firstNumber(arguments_)),
  log1p: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.log1p(firstNumber(arguments_)),
  log2: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.log2(firstNumber(arguments_)),
  max: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.max(...numbers(arguments_)),
  min: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.min(...numbers(arguments_)),
  pow: (arguments_: CanonicalValueStaticPrimitiveVector) =>
    Math.pow(Number(arguments_[0]), Number(arguments_[1])),
  round: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.round(firstNumber(arguments_)),
  sign: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.sign(firstNumber(arguments_)),
  sin: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.sin(firstNumber(arguments_)),
  sinh: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.sinh(firstNumber(arguments_)),
  sqrt: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.sqrt(firstNumber(arguments_)),
  tan: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.tan(firstNumber(arguments_)),
  tanh: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.tanh(firstNumber(arguments_)),
  trunc: (arguments_: CanonicalValueStaticPrimitiveVector) => Math.trunc(firstNumber(arguments_)),
};

const staticMathMethod = (
  environment: CanonicalValueStaticInvocationEnvironment,
  fact: CanonicalValueInvocationFact,
): CanonicalValueStaticPrimitiveEvaluator | null => {
  const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: "Math",
    origin: fact.target,
  });
  const method = path?.length === 1 ? path[0] : undefined;
  return method === undefined ? null : (STATIC_MATH_EVALUATORS[method] ?? null);
};

const mathConstruction = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly evaluator: CanonicalValueStaticPrimitiveEvaluator;
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  mapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: input.evaluator,
  });

export const resolveCanonicalValueStaticNumberInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const numberString = resolveCanonicalValueStaticNumberStringInvocation(environment, input);
  if (numberString !== null) return numberString;
  const converter = primitiveConstructor(environment, input.fact);
  if (converter !== null) return primitiveConstruction(environment, { ...input, converter });
  if (isValueOfTarget(environment, input.fact)) return receiverPrimitives(environment, input);
  const parser = parseMethod(environment, input.fact);
  if (parser !== null) return parseConstruction(environment, { ...input, parser });
  const evaluator = staticMathMethod(environment, input.fact);
  return evaluator === null ? null : mathConstruction(environment, { ...input, evaluator });
};
