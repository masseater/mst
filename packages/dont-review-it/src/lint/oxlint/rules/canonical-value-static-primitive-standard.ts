import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import {
  resolveCanonicalValueStaticInvocationArgumentVectors,
  type CanonicalValueStaticPrimitiveEvaluator,
  type CanonicalValueStaticPrimitiveVector,
} from "./canonical-value-static-array.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import {
  canonicalValueStaticGlobalFunctionTarget,
  canonicalValueStaticGlobalTarget,
} from "./canonical-value-static-standard-target.ts";

import type {
  CanonicalValueStaticInvocationEnvironment,
  CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";

const first = (arguments_: CanonicalValueStaticPrimitiveVector): CanonicalValueStaticPrimitive =>
  arguments_[0];

const STATIC_NUMBER_METHODS: Readonly<Record<string, CanonicalValueStaticPrimitiveEvaluator>> = {
  isFinite: (arguments_) => Number.isFinite(first(arguments_)),
  isInteger: (arguments_) => Number.isInteger(first(arguments_)),
  isNaN: (arguments_) => Number.isNaN(first(arguments_)),
  isSafeInteger: (arguments_) => Number.isSafeInteger(first(arguments_)),
};

const STATIC_GLOBAL_FUNCTIONS: Readonly<Record<string, CanonicalValueStaticPrimitiveEvaluator>> = {
  encodeURI: (arguments_) => encodeURI(String(first(arguments_))),
  encodeURIComponent: (arguments_) => encodeURIComponent(String(first(arguments_))),
  isFinite: (arguments_) => isFinite(first(arguments_) as number),
  isNaN: (arguments_) => isNaN(first(arguments_) as number),
};

const evaluated = (
  evaluator: CanonicalValueStaticPrimitiveEvaluator,
  arguments_: CanonicalValueStaticPrimitiveVector,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  try {
    return closedCandidateSet([evaluator(arguments_)], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (
      error instanceof RangeError ||
      error instanceof SyntaxError ||
      error instanceof TypeError ||
      error instanceof URIError
    ) {
      return unknownCandidateSet();
    }
    throw error;
  }
};

const evaluateArguments = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly evaluator: CanonicalValueStaticPrimitiveEvaluator;
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (arguments_) => evaluated(input.evaluator, arguments_),
  });

const globalMethodEvaluator = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly evaluators: Readonly<Record<string, CanonicalValueStaticPrimitiveEvaluator>>;
    readonly globalName: string;
  },
): CanonicalValueStaticPrimitiveEvaluator | null => {
  for (const [method, evaluator] of Object.entries(input.evaluators)) {
    if (
      canonicalValueStaticGlobalTarget(environment, {
        fact: input.fact,
        globalName: input.globalName,
        path: [method],
        query: input.query,
      })
    ) {
      return evaluator;
    }
  }
  return null;
};

const globalFunctionEvaluator = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CanonicalValueStaticPrimitiveEvaluator | null => {
  for (const [name, evaluator] of Object.entries(STATIC_GLOBAL_FUNCTIONS)) {
    if (
      canonicalValueStaticGlobalFunctionTarget(environment, {
        fact: input.fact,
        name,
        query: input.query,
      })
    ) {
      return evaluator;
    }
  }
  return null;
};

const jsonStringify = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  if (
    !canonicalValueStaticGlobalTarget(environment, {
      fact: input.fact,
      globalName: "JSON",
      path: ["stringify"],
      query: input.query,
    })
  ) {
    return null;
  }
  return evaluateArguments(environment, {
    ...input,
    evaluator: (arguments_) => {
      if (arguments_.length > 1) throw new TypeError();
      return JSON.stringify(arguments_[0]);
    },
  });
};

export const resolveCanonicalValueStaticPrimitiveStandardInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const stringify = jsonStringify(environment, input);
  if (stringify !== null) return stringify;
  const numberEvaluator = globalMethodEvaluator(environment, {
    ...input,
    evaluators: STATIC_NUMBER_METHODS,
    globalName: "Number",
  });
  if (numberEvaluator !== null) {
    return evaluateArguments(environment, { ...input, evaluator: numberEvaluator });
  }
  const globalEvaluator = globalFunctionEvaluator(environment, input);
  return globalEvaluator === null
    ? null
    : evaluateArguments(environment, { ...input, evaluator: globalEvaluator });
};
