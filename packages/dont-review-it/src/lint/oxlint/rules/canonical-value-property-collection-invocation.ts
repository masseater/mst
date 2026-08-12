import {
  closedCandidateSet,
  flatMapCandidateSet,
  joinCandidateSets,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueLogicalInvocationArguments } from "./canonical-value-invocation-segments.ts";
import { canonicalValueReceiverCollectionInvocationOrigins } from "./canonical-value-property-collection-receiver.ts";
import { canonicalValueObjectPropertyIsPrototypeSetter } from "./canonical-value-property-name-structure.ts";
import {
  appendCanonicalValueOriginPath,
  appendCanonicalValueOriginProjection,
  canonicalValueExpressionOrigin,
  canonicalValueOriginKey,
  type CanonicalValueOrigin,
} from "./canonical-value-property-origin.ts";
import {
  type CanonicalValuePropertyInternals,
  type CanonicalValueResolvedPropertyQuery,
} from "./canonical-value-property-runtime.ts";
import { canonicalValuePropertyGlobalTarget } from "./canonical-value-property-standard-target.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueInvocationFact } from "./canonical-value-invocation-types.ts";

type InvocationInput = CanonicalValueResolvedPropertyQuery & {
  readonly expression: ESTree.CallExpression;
};

const resultOrigin = (
  input: InvocationInput,
  projections: Parameters<typeof canonicalValueExpressionOrigin>[1],
): CandidateSet<CanonicalValueOrigin> =>
  closedCandidateSet(
    [
      appendCanonicalValueOriginPath(
        canonicalValueExpressionOrigin(input.expression, projections),
        input.path,
      ),
    ],
    canonicalValueOriginKey,
  );

const argumentOrigins = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact; readonly index: number },
): CandidateSet<CanonicalValueOrigin> =>
  mapCandidateSet(state.invocationArgumentOrigins(input.fact, input.index), {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (origin) => appendCanonicalValueOriginPath(origin, input.path),
  });

const iterableArgumentOrigins = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact; readonly index: number },
): CandidateSet<CanonicalValueOrigin> =>
  mapCandidateSet(state.invocationArgumentOrigins(input.fact, input.index), {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (origin) =>
      appendCanonicalValueOriginPath(
        appendCanonicalValueOriginProjection(origin, { kind: "array-element" }),
        input.path,
      ),
  });

const objectValueArguments = (
  object: ESTree.ObjectExpression,
): readonly ESTree.Argument[] | null => {
  const arguments_ = object.properties.flatMap((property) =>
    property.type === "Property" && !canonicalValueObjectPropertyIsPrototypeSetter(property)
      ? [property.value]
      : [],
  );
  const ownProperties = object.properties.filter(
    (property) =>
      property.type === "Property" && !canonicalValueObjectPropertyIsPrototypeSetter(property),
  );
  return arguments_.length === ownProperties.length &&
    ownProperties.length === object.properties.length
    ? arguments_
    : null;
};

const objectValueOrigins = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact },
): CandidateSet<CanonicalValueOrigin> =>
  flatMapCandidateSet(state.invocationArgumentOrigins(input.fact, 0), {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (origin) => {
      if (origin.kind === "absent" || origin.projections.length !== 0) {
        return unknownCandidateSet();
      }
      const object = unwrapExpression(origin.expression);
      if (object.type !== "ObjectExpression") return unknownCandidateSet();
      const arguments_ = objectValueArguments(object);
      return arguments_ === null
        ? unknownCandidateSet()
        : resultOrigin(input, [
            {
              kind: "call-arguments",
              segments: [{ elements: arguments_, kind: "direct" }],
              startIndex: 0,
            },
          ]);
    },
  });

const propertyNameOrigins = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact },
): CandidateSet<CanonicalValueOrigin> =>
  mapCandidateSet(state.invocationArgumentOrigins(input.fact, 0), {
    candidateKey: canonicalValueOriginKey,
    mapCandidate: (origin) =>
      appendCanonicalValueOriginPath(
        appendCanonicalValueOriginProjection(origin, { kind: "property-name" }),
        input.path,
      ),
  });

const emptyArrayTarget = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact },
): boolean => {
  const origins = state.invocationArgumentOrigins(input.fact, 0);
  return (
    origins.complete &&
    origins.candidates.length !== 0 &&
    origins.candidates.every(
      (origin) =>
        origin.kind === "expression" &&
        origin.projections.length === 0 &&
        origin.expression.type === "ArrayExpression" &&
        origin.expression.elements.length === 0,
    )
  );
};

const simpleGlobalResolution = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact },
): CandidateSet<CanonicalValueOrigin> | null => {
  for (const [globalName, targetPath, resolve] of [
    ["Object", ["values"], () => objectValueOrigins(state, input)],
    ["Object", ["getOwnPropertyNames"], () => propertyNameOrigins(state, input)],
    ["Reflect", ["ownKeys"], () => propertyNameOrigins(state, input)],
    ["Object", ["freeze"], () => argumentOrigins(state, { ...input, index: 0 })],
    ["Object", ["seal"], () => argumentOrigins(state, { ...input, index: 0 })],
    ["Object", ["preventExtensions"], () => argumentOrigins(state, { ...input, index: 0 })],
    ["structuredClone", [], () => argumentOrigins(state, { ...input, index: 0 })],
  ] as const) {
    const target = canonicalValuePropertyGlobalTarget(state, {
      ...input,
      globalName,
      targetPath,
    });
    if (target !== null) return target.stable ? resolve() : unknownCandidateSet();
  }
  return null;
};

const objectAssignResolution = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact },
): CandidateSet<CanonicalValueOrigin> | null => {
  const assign = canonicalValuePropertyGlobalTarget(state, {
    ...input,
    globalName: "Object",
    targetPath: ["assign"],
  });
  if (assign === null) return null;
  const arguments_ = canonicalValueLogicalInvocationArguments(input.fact);
  return assign.stable && arguments_?.length === 2 && emptyArrayTarget(state, input)
    ? argumentOrigins(state, { ...input, index: 1 })
    : unknownCandidateSet();
};

const arrayCreationResolution = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & {
    readonly fact: CanonicalValueInvocationFact;
    readonly targetPath: readonly string[];
  },
): CandidateSet<CanonicalValueOrigin> | null => {
  const target = canonicalValuePropertyGlobalTarget(state, {
    ...input,
    globalName: "Array",
    targetPath: input.targetPath,
  });
  return target === null
    ? null
    : target.stable
      ? resultOrigin(input, [
          { kind: "call-arguments", segments: input.fact.argumentSegments, startIndex: 0 },
        ])
      : unknownCandidateSet();
};

const arrayFromResolution = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact },
): CandidateSet<CanonicalValueOrigin> | null => {
  const target = canonicalValuePropertyGlobalTarget(state, {
    ...input,
    globalName: "Array",
    targetPath: ["from"],
  });
  if (target === null) return null;
  const mapper = state.invocationArgumentOrigins(input.fact, 1);
  const withoutMapper =
    mapper.complete && mapper.candidates.every((origin) => origin.kind === "absent");
  if (!target.stable) return unknownCandidateSet();
  return withoutMapper ? iterableArgumentOrigins(state, { ...input, index: 0 }) : null;
};

const factResolution = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput & { readonly fact: CanonicalValueInvocationFact },
): CandidateSet<CanonicalValueOrigin> | null =>
  simpleGlobalResolution(state, input) ??
  objectAssignResolution(state, input) ??
  arrayCreationResolution(state, { ...input, targetPath: [] }) ??
  arrayCreationResolution(state, { ...input, targetPath: ["of"] }) ??
  arrayFromResolution(state, input) ??
  canonicalValueReceiverCollectionInvocationOrigins(state, input);

export const canonicalValueStandardCollectionInvocationOrigins = (
  state: CanonicalValuePropertyInternals,
  input: InvocationInput,
): CandidateSet<CanonicalValueOrigin> | null => {
  const facts = state.invocationFacts(input.expression);
  const resolutions = facts.candidates
    .map((fact) => factResolution(state, { ...input, fact }))
    .filter((resolution): resolution is CandidateSet<CanonicalValueOrigin> => resolution !== null);
  if (resolutions.length === 0) return null;
  const joined = joinCandidateSets(resolutions, canonicalValueOriginKey);
  return facts.complete &&
    resolutions.length === facts.candidates.length &&
    resolutions.every((resolution) => resolution.complete)
    ? joined
    : openCandidateSet(joined.candidates, canonicalValueOriginKey);
};
