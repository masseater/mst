import {
  closedCandidateSet,
  flatMapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { popCanonicalValueInvocationProperty } from "./canonical-value-invocation-normalization.ts";
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

const primitiveToStringOwner = (primitive: CanonicalValueStaticPrimitive): string | null => {
  if (typeof primitive === "bigint") return "BigInt";
  if (typeof primitive === "boolean") return "Boolean";
  if (typeof primitive === "number") return "Number";
  return typeof primitive === "string" ? "String" : null;
};

const targetOwners = (input: CanonicalValueStaticInvocationInput): CandidateSet<string> | null => {
  const base = popCanonicalValueInvocationProperty(input.fact.target, "toString");
  if (base?.projections.length !== 0) return null;
  const primitives = input.resolve({ ...input.query, expression: base.expression });
  const owners = primitives.candidates.flatMap((primitive) => {
    const owner = primitiveToStringOwner(primitive);
    return owner === null ? [] : [owner];
  });
  return primitives.complete && owners.length === primitives.candidates.length
    ? closedCandidateSet(owners, String)
    : openCandidateSet(owners, String);
};

const numberString = (receiver: number, radix: CanonicalValueStaticPrimitive | undefined): string =>
  receiver.toString(radix === undefined ? undefined : Number(radix));

const bigintString = (receiver: bigint, radix: CanonicalValueStaticPrimitive | undefined): string =>
  receiver.toString(radix === undefined ? undefined : Number(radix));

const primitiveStringSpelling = (input: {
  readonly arguments: CanonicalValueStaticPrimitiveVector;
  readonly owner: string;
  readonly receiver: CanonicalValueStaticPrimitive;
}): string | null => {
  const radix = input.arguments[0];
  if (input.owner === "BigInt" && typeof input.receiver === "bigint") {
    return bigintString(input.receiver, radix);
  }
  if (input.owner === "Boolean" && typeof input.receiver === "boolean") {
    return String(input.receiver);
  }
  if (input.owner === "Number" && typeof input.receiver === "number") {
    return numberString(input.receiver, radix);
  }
  return input.owner === "String" && typeof input.receiver === "string" ? input.receiver : null;
};

const primitiveString = (input: {
  readonly arguments: CanonicalValueStaticPrimitiveVector;
  readonly owner: string;
  readonly receiver: CanonicalValueStaticPrimitive;
}): CandidateSet<CanonicalValueStaticPrimitive> => {
  try {
    const spelling = primitiveStringSpelling(input);
    return spelling === null
      ? unknownCandidateSet()
      : closedCandidateSet([spelling], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (error instanceof RangeError || error instanceof TypeError) return unknownCandidateSet();
    throw error;
  }
};

const stablePrimitiveStrings = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly owner: string;
    readonly receivers: CandidateSet<CanonicalValueStaticPrimitive>;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (
    !canonicalValueStandardPathIsStable(
      { bindingIndex: environment.bindingIndex, execution: environment.propertyState.execution },
      { ...input.query, path: [input.owner, "prototype", "toString"] },
    )
  ) {
    return unknownCandidateSet();
  }
  return flatMapCandidateSet(input.receivers, {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (receiver) =>
      flatMapCandidateSet(
        resolveCanonicalValueStaticInvocationArgumentVectors(environment, input),
        {
          candidateKey: canonicalValueStaticPrimitiveKey,
          mapCandidate: (arguments_) =>
            primitiveString({ arguments: arguments_, owner: input.owner, receiver }),
        },
      ),
  });
};

export const resolveCanonicalValueStaticToStringInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const owners = targetOwners(input);
  if (owners === null || input.fact.thisArgument === null) return null;
  const receivers = input.resolve({ ...input.query, expression: input.fact.thisArgument });
  return flatMapCandidateSet(owners, {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (owner) => stablePrimitiveStrings(environment, { ...input, owner, receivers }),
  });
};
