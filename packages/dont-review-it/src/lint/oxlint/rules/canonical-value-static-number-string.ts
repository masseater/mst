import {
  closedCandidateSet,
  flatMapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { popCanonicalValueInvocationProperty } from "./canonical-value-invocation-normalization.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import { canonicalValueStandardPathIsStable } from "./canonical-value-standard-stability.ts";
import {
  resolveCanonicalValueStaticInvocationArgumentVectors,
  type CanonicalValueStaticPrimitiveVector,
} from "./canonical-value-static-array.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";

import type {
  CanonicalValueStaticInvocationEnvironment,
  CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";

const NUMBER_STRING_METHODS: ReadonlySet<string> = new Set([
  "toExponential",
  "toFixed",
  "toPrecision",
]);

const directNumberMethod = (input: CanonicalValueStaticInvocationInput): string | null => {
  const [method] = canonicalValueInvocationPropertyPath(input.fact.target) ?? [];
  if (method === undefined || !NUMBER_STRING_METHODS.has(method)) return null;
  const base = popCanonicalValueInvocationProperty(input.fact.target, method);
  if (base?.projections.length !== 0) return null;
  const candidates = input.resolve({ ...input.query, expression: base.expression });
  return candidates.complete && candidates.candidates.every((value) => typeof value === "number")
    ? method
    : null;
};

const numberString = (input: {
  readonly arguments: CanonicalValueStaticPrimitiveVector;
  readonly method: string;
  readonly receiver: CanonicalValueStaticPrimitive;
}): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (typeof input.receiver !== "number" || typeof input.arguments[0] === "bigint") {
    return unknownCandidateSet();
  }
  const digits = input.arguments[0] === undefined ? undefined : Number(input.arguments[0]);
  try {
    const spelling =
      input.method === "toExponential"
        ? input.receiver.toExponential(digits)
        : input.method === "toFixed"
          ? input.receiver.toFixed(digits)
          : input.receiver.toPrecision(digits);
    return closedCandidateSet([spelling], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) return unknownCandidateSet();
    throw error;
  }
};

export const resolveCanonicalValueStaticNumberStringInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const method = directNumberMethod(input);
  if (method === null || input.fact.thisArgument === null) return null;
  if (
    !canonicalValueStandardPathIsStable(
      { bindingIndex: environment.bindingIndex, execution: environment.propertyState.execution },
      { ...input.query, path: ["Number", "prototype", method] },
    )
  ) {
    return unknownCandidateSet();
  }
  const receivers = input.resolve({ ...input.query, expression: input.fact.thisArgument });
  return flatMapCandidateSet(receivers, {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (receiver) =>
      flatMapCandidateSet(
        resolveCanonicalValueStaticInvocationArgumentVectors(environment, input),
        {
          candidateKey: canonicalValueStaticPrimitiveKey,
          mapCandidate: (arguments_) => numberString({ arguments: arguments_, method, receiver }),
        },
      ),
  });
};
