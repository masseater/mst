import {
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueInvocationPropertyPath } from "./canonical-value-invocation-target.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import {
  type CanonicalValueStaticInvocationEnvironment,
  type CanonicalValueStaticInvocationInput,
  type CanonicalValueStaticResolutionContext,
} from "./canonical-value-static-invocation-types.ts";
import {
  argumentObjectStates,
  objectStatesForExpression,
  type StaticObjectState,
} from "./canonical-value-static-object-predicate.ts";
import {
  canonicalValueStaticPrimitiveKey,
  type CanonicalValueStaticPrimitive,
} from "./canonical-value-static-primitive.ts";
import {
  canonicalValueStaticGlobalTarget,
  canonicalValueStaticStandardPathIsStable,
} from "./canonical-value-static-standard-target.ts";

import type { ESTree } from "@oxlint/plugins";

const argumentPrimitives = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & { readonly index: number },
): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(environment.invocationState.argumentOrigins(input.fact, input.index), {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (origin) =>
      origin.kind === "absent" || origin.projections.length !== 0
        ? unknownCandidateSet()
        : input.resolve({ ...input.query, expression: origin.expression }),
  });

const STATE_PREDICATES = [
  ["Object", "isExtensible", (state: StaticObjectState) => state.extensible],
  ["Object", "isFrozen", (state: StaticObjectState) => state.frozen],
  ["Object", "isSealed", (state: StaticObjectState) => state.sealed],
  ["Reflect", "isExtensible", (state: StaticObjectState) => state.extensible],
  ["ArrayBuffer", "isView", (state: StaticObjectState) => state.isView],
] as const;

const objectStatePredicate = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const predicate = STATE_PREDICATES.find(([globalName, method]) =>
    canonicalValueStaticGlobalTarget(environment, {
      fact: input.fact,
      globalName,
      path: [method],
      query: input.query,
    }),
  );
  return predicate === undefined
    ? null
    : mapCandidateSet(argumentObjectStates(environment, { ...input, index: 0 }), {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: predicate[2],
      });
};

const hasOwn = (state: StaticObjectState, key: string): boolean | null => {
  if (state.properties.some((property) => property.key === key)) return true;
  return state.propertiesComplete ? false : null;
};

const prototypePredicateMethod = (value: string | null): string | null =>
  value === "hasOwnProperty" || value === "propertyIsEnumerable" ? value : null;

const prototypeMethodOf = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): string | null => {
  const directPath = canonicalValueInvocationPropertyPath(input.fact.target);
  const directMethod = prototypePredicateMethod(
    directPath?.length === 1 ? (directPath[0] ?? null) : null,
  );
  if (directMethod !== null) return directMethod;
  const globalPath = canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
    name: "Object",
    origin: input.fact.target,
  });
  return prototypePredicateMethod(
    globalPath?.length === 2 && globalPath[0] === "prototype" ? (globalPath[1] ?? null) : null,
  );
};

const globalOwnPropertyPredicate = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): boolean =>
  canonicalValueStaticGlobalTarget(environment, {
    fact: input.fact,
    globalName: "Object",
    path: ["hasOwn"],
    query: input.query,
  }) ||
  canonicalValueStaticGlobalTarget(environment, {
    fact: input.fact,
    globalName: "Reflect",
    path: ["has"],
    query: input.query,
  });

const propertyPredicateCandidate = (input: {
  readonly key: string;
  readonly method: string | null;
  readonly state: StaticObjectState;
}): CandidateSet<CanonicalValueStaticPrimitive> => {
  if (
    input.method !== null &&
    (!input.state.standardObjectPrototype || hasOwn(input.state, input.method) === true)
  ) {
    return unknownCandidateSet();
  }
  const owns = hasOwn(input.state, input.key);
  if (owns === null) return unknownCandidateSet();
  const enumerable = input.state.properties.find(
    (property) => property.key === input.key,
  )?.enumerable;
  const predicateValue =
    input.method === "propertyIsEnumerable" ? owns && enumerable === true : owns;
  return closedCandidateSet([predicateValue], canonicalValueStaticPrimitiveKey);
};

const propertyPredicateCandidates = (input: {
  readonly keys: CandidateSet<CanonicalValueStaticPrimitive>;
  readonly method: string | null;
  readonly states: CandidateSet<StaticObjectState>;
}): CandidateSet<CanonicalValueStaticPrimitive> =>
  flatMapCandidateSet(input.states, {
    candidateKey: canonicalValueStaticPrimitiveKey,
    mapCandidate: (state) =>
      flatMapCandidateSet(input.keys, {
        candidateKey: canonicalValueStaticPrimitiveKey,
        mapCandidate: (primitive) =>
          propertyPredicateCandidate({ key: String(primitive), method: input.method, state }),
      }),
  });

const directPropertyPredicateCandidates = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly argument: ESTree.Expression;
    readonly method: string;
    readonly receiver: ESTree.Expression;
  },
): CandidateSet<CanonicalValueStaticPrimitive> => {
  const states = objectStatesForExpression(environment, {
    ...input,
    expression: input.receiver,
    seen: new Set(),
  });
  const keys = input.resolve({ ...input.query, expression: input.argument });
  return propertyPredicateCandidates({ keys, method: input.method, states });
};

const prototypeReceiverStates = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<StaticObjectState> =>
  input.fact.thisArgument === null
    ? unknownCandidateSet()
    : objectStatesForExpression(environment, {
        ...input,
        expression: input.fact.thisArgument,
        seen: new Set(),
      });

const ownPropertyPredicate = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const globalMethod = globalOwnPropertyPredicate(environment, input);
  const prototypeMethod = prototypeMethodOf(environment, input);
  if (!globalMethod && prototypeMethod === null) return null;
  if (
    prototypeMethod !== null &&
    !canonicalValueStaticStandardPathIsStable(environment, {
      path: ["Object", "prototype", prototypeMethod],
      query: input.query,
    })
  ) {
    return unknownCandidateSet();
  }
  const states = globalMethod
    ? argumentObjectStates(environment, { ...input, index: 0 })
    : prototypeReceiverStates(environment, input);
  const keys = argumentPrimitives(environment, { ...input, index: globalMethod ? 1 : 0 });
  return propertyPredicateCandidates({ keys, method: prototypeMethod, states });
};

export const resolveCanonicalValueStaticDirectObjectPredicateInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & { readonly expression: ESTree.CallExpression },
): CandidateSet<CanonicalValueStaticPrimitive> | null => {
  const callee = unwrapExpression(input.expression.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return null;
  const method = prototypePredicateMethod(canonicalValueStaticMemberName(callee));
  if (method === null) return null;
  if (
    !canonicalValueStaticStandardPathIsStable(environment, {
      path: ["Object", "prototype", method],
      query: input.query,
    })
  ) {
    return unknownCandidateSet();
  }
  const argument = input.expression.arguments[0];
  if (argument === undefined || argument.type === "SpreadElement") return unknownCandidateSet();
  return directPropertyPredicateCandidates(environment, {
    ...input,
    argument,
    method,
    receiver: callee.object,
  });
};

export const resolveCanonicalValueStaticObjectPredicateInvocation = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): CandidateSet<CanonicalValueStaticPrimitive> | null =>
  objectStatePredicate(environment, input) ?? ownPropertyPredicate(environment, input);
