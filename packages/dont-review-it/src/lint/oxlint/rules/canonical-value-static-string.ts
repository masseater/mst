import {
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import {
  canonicalValueStaticPrimitiveVectorKey,
  resolveCanonicalValueStaticArrayOriginVectors,
  resolveCanonicalValueStaticInvocationArgumentVectors,
  type CanonicalValueStaticPrimitiveVector,
} from "./canonical-value-static-array.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import {
  type CanonicalValueStaticInvocationEnvironment,
  type CanonicalValueStaticInvocationInput,
} from "./canonical-value-static-invocation-types.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import { canonicalValueStaticStandardPathIsStable } from "./canonical-value-static-standard-target.ts";

import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";

const stringConstructorMethod = (
  environment: CanonicalValueStaticInvocationEnvironment,
  fact: CanonicalValueInvocationFact,
): "fromCharCode" | "fromCodePoint" | null => {
  const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: "String",
    origin: fact.target,
  });
  if (path?.length !== 1) return null;
  return path[0] === "fromCharCode" || path[0] === "fromCodePoint" ? path[0] : null;
};

const stringFromNumbers = (
  method: "fromCharCode" | "fromCodePoint",
  primitives: CanonicalValueStaticPrimitiveVector,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const numbers = primitives.map(Number);
  try {
    const spelling =
      method === "fromCharCode"
        ? String.fromCharCode(...numbers)
        : String.fromCodePoint(...numbers);
    return closedCandidateSet([spelling], canonicalValueStaticPrimitiveKey);
  } catch (error) {
    if (error instanceof RangeError) return unknownCandidateSet();
    throw error;
  }
};

const stringConstruction = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly method: "fromCharCode" | "fromCodePoint";
  },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (primitives) => stringFromNumbers(input.method, primitives),
  });

const canonicalValueIsStringMethodTarget = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: {
    readonly fact: CanonicalValueInvocationFact;
    readonly method: string;
  },
): boolean => canonicalValueStringMethodName(environment, input.fact) === input.method;

export const canonicalValueStringMethodName = (
  environment: CanonicalValueStaticInvocationEnvironment,
  fact: CanonicalValueInvocationFact,
): string | null => {
  const directPath = canonicalValueInvocationPropertyPath(fact.target);
  if (directPath?.length === 1) return directPath[0] ?? null;
  const globalPath = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: "String",
    origin: fact.target,
  });
  return globalPath?.length === 2 && globalPath[0] === "prototype" ? (globalPath[1] ?? null) : null;
};

export const canonicalValueStaticStringReceivers = (
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<string> => {
  if (input.fact.thisArgument === null) return unknownCandidateSet();
  const resolved = input.resolve({
    ...input.query,
    expression: input.fact.thisArgument,
  });
  const candidates = resolved.candidates.filter(
    (candidate): candidate is string => typeof candidate === "string",
  );
  return resolved.complete && candidates.length === resolved.candidates.length
    ? closedCandidateSet(candidates, String)
    : openCandidateSet(candidates, String);
};

const stringConcat = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(canonicalValueStaticStringReceivers(input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (receiver) =>
      mapCandidateSet(resolveCanonicalValueStaticInvocationArgumentVectors(environment, input), {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: (arguments_) => receiver.concat(...arguments_.map(String)),
      }),
  });

const slicedString = (
  receiver: string,
  arguments_: CanonicalValueStaticPrimitiveVector,
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const [startPrimitive, endPrimitive] = arguments_;
  if (typeof startPrimitive === "bigint" || typeof endPrimitive === "bigint") {
    return unknownCandidateSet();
  }
  const start = startPrimitive === undefined ? undefined : Number(startPrimitive);
  const end = endPrimitive === undefined ? undefined : Number(endPrimitive);
  return closedCandidateSet([receiver.slice(start, end)], canonicalValueStaticPrimitiveKey);
};

const stringSlice = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(canonicalValueStaticStringReceivers(input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (receiver) =>
      flatMapCandidateSet(
        resolveCanonicalValueStaticInvocationArgumentVectors(environment, input),
        {
          candidateKey: canonicalValueStaticPrimitiveKey,
          mapCandidate: (arguments_) => slicedString(receiver, arguments_),
        },
      ),
  });

const rawPropertyVectors = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & { readonly origin: CanonicalValueOrigin },
): CandidateSet<CanonicalValueStaticPrimitiveVector> => {
  if (input.origin.kind === "absent") return unknownCandidateSet();
  const path = canonicalValueInvocationPropertyPath(input.origin);
  if (path === null) return unknownCandidateSet();
  return flatMapCandidateSet(
    environment.propertyState.origins({
      cutoff: input.query.cutoff,
      executionContext: input.query.executionContext,
      expression: input.origin.expression,
      path: [...path, "raw"],
    }),
    {
      candidateKey: canonicalValueStaticPrimitiveVectorKey,
      mapCandidate: (origin) =>
        resolveCanonicalValueStaticArrayOriginVectors(environment, {
          ...input,
          origin,
          seen: new Set(),
        }),
    },
  );
};

const rawVectors = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitiveVector> =>
  flatMapCandidateSet(environment.invocationState.argumentOrigins(input.fact, 0), {
    candidateKey: canonicalValueStaticPrimitiveVectorKey,
    mapCandidate: (origin) => rawPropertyVectors(environment, { ...input, origin }),
  });

const rawSubstitutions = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & { readonly index: number },
): CandidateSet<string> =>
  flatMapCandidateSet(environment.invocationState.argumentOrigins(input.fact, input.index), {
    candidateKey: String,
    mapCandidate: (origin) => {
      if (origin.kind === "absent") return closedCandidateSet([""], String);
      if (origin.projections.length !== 0) return unknownCandidateSet();
      return mapCandidateSet(input.resolve({ ...input.query, expression: origin.expression }), {
        candidateKey: String,
        mapCandidate: String,
      });
    },
  });

const rawString = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & {
    readonly raw: CanonicalValueStaticPrimitiveVector;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const initial = closedCandidateSet([input.raw.length === 0 ? "" : String(input.raw[0])], String);
  return input.raw
    .slice(1)
    .entries()
    .reduce<CandidateSet<string>>((prefixes, [offset, segment]) => {
      const substitutions = rawSubstitutions(environment, { ...input, index: offset + 1 });
      return flatMapCandidateSet(prefixes, {
        candidateKey: String,
        mapCandidate: (prefix) =>
          mapCandidateSet(substitutions, {
            candidateKey: String,
            mapCandidate: (substitution) => `${prefix}${substitution}${String(segment)}`,
          }),
      });
    }, initial);
};

const stringRaw = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(rawVectors(environment, input), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (raw) => rawString(environment, { ...input, raw }),
  });

const isStringRawTarget = (
  environment: CanonicalValueStaticInvocationEnvironment,
  fact: CanonicalValueInvocationFact,
): boolean => {
  const path = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: "String",
    origin: fact.target,
  });
  return path?.length === 1 && path[0] === "raw";
};

export const resolveCanonicalValueStaticStringInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const method = stringConstructorMethod(environment, input.fact);
  if (method !== null) {
    return canonicalValueStaticStandardPathIsStable(environment, {
      path: ["String", method],
      query: input.query,
    })
      ? stringConstruction(environment, { ...input, method })
      : unknownCandidateSet();
  }
  if (
    canonicalValueIsStringMethodTarget(environment, {
      fact: input.fact,
      method: "concat",
    })
  ) {
    return canonicalValueStaticStandardPathIsStable(environment, {
      path: ["String", "prototype", "concat"],
      query: input.query,
    })
      ? stringConcat(environment, input)
      : unknownCandidateSet();
  }
  if (
    canonicalValueIsStringMethodTarget(environment, {
      fact: input.fact,
      method: "slice",
    })
  ) {
    return canonicalValueStaticStandardPathIsStable(environment, {
      path: ["String", "prototype", "slice"],
      query: input.query,
    })
      ? stringSlice(environment, input)
      : unknownCandidateSet();
  }
  if (!isStringRawTarget(environment, input.fact)) return null;
  return canonicalValueStaticStandardPathIsStable(environment, {
    path: ["String", "raw"],
    query: input.query,
  })
    ? stringRaw(environment, input)
    : unknownCandidateSet();
};
