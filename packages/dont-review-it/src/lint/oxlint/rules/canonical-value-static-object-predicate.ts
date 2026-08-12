import {
  closedCandidateSet,
  flatMapCandidateSet,
  mapCandidateSet,
  openCandidateSet,
  unknownCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueArgumentExpression } from "./canonical-value-call-arguments.ts";
import { canonicalValueLogicalInvocationArguments } from "./canonical-value-invocation-segments.ts";
import { canonicalValueObjectPropertyIsPrototypeSetter } from "./canonical-value-property-name-structure.ts";
import { canonicalValueStaticGlobalPropertyPath } from "./canonical-value-static-global.ts";
import { canonicalValueStaticGlobalTarget } from "./canonical-value-static-standard-target.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type {
  CanonicalValueStaticInvocationEnvironment,
  CanonicalValueStaticInvocationInput,
  CanonicalValueStaticResolutionContext,
} from "./canonical-value-static-invocation-types.ts";

type StaticProperty = {
  readonly configurable: boolean;
  readonly enumerable: boolean;
  readonly key: string;
  readonly writable: boolean;
};

export type StaticObjectState = {
  readonly extensible: boolean;
  readonly frozen: boolean;
  readonly isView: boolean;
  readonly properties: readonly StaticProperty[];
  readonly propertiesComplete: boolean;
  readonly sealed: boolean;
  readonly standardObjectPrototype: boolean;
};

const objectStateKey = (state: StaticObjectState): string =>
  JSON.stringify({
    ...state,
    properties: state.properties.toSorted((left, right) => left.key.localeCompare(right.key)),
  });

const directObjectState = (
  properties: readonly StaticProperty[] = [],
  propertiesComplete = true,
): StaticObjectState => ({
  extensible: true,
  frozen: false,
  isView: false,
  properties,
  propertiesComplete,
  sealed: false,
  standardObjectPrototype: true,
});

const propertyDescriptor = (property: ESTree.ObjectProperty, key: string): StaticProperty => ({
  configurable: true,
  enumerable: true,
  key,
  writable: property.kind === "init" || property.method,
});

const appendProperty = (state: StaticObjectState, property: StaticProperty): StaticObjectState => ({
  ...state,
  properties: [...state.properties.filter((candidate) => candidate.key !== property.key), property],
});

const objectExpressionStates = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & { readonly expression: ESTree.ObjectExpression },
): CandidateSet<StaticObjectState> =>
  input.expression.properties.reduce<CandidateSet<StaticObjectState>>(
    (states, property) => {
      if (property.type === "SpreadElement") {
        return openCandidateSet(
          states.candidates.map((state) => ({ ...state, propertiesComplete: false })),
          objectStateKey,
        );
      }
      if (canonicalValueObjectPropertyIsPrototypeSetter(property)) {
        return mapCandidateSet(states, {
          candidateKey: objectStateKey,
          mapCandidate: (state) => ({ ...state, standardObjectPrototype: false }),
        });
      }
      const keys = environment.propertyState.propertyKeys({
        computed: property.computed,
        cutoff: input.query.cutoff,
        executionContext: input.query.executionContext,
        key: property.key,
      });
      const next = flatMapCandidateSet(states, {
        candidateKey: objectStateKey,
        mapCandidate: (state) =>
          mapCandidateSet(keys, {
            candidateKey: objectStateKey,
            mapCandidate: (key) => appendProperty(state, propertyDescriptor(property, key)),
          }),
      });
      return keys.complete ? next : openCandidateSet(next.candidates, objectStateKey);
    },
    closedCandidateSet([directObjectState()], objectStateKey),
  );

const wrapperState = (
  state: StaticObjectState,
  method: "freeze" | "preventExtensions" | "seal",
): StaticObjectState => {
  if (method === "freeze") {
    return {
      ...state,
      extensible: false,
      frozen: true,
      properties: state.properties.map((property) => ({
        ...property,
        configurable: false,
        writable: false,
      })),
      sealed: true,
    };
  }
  if (method === "seal") {
    const properties = state.properties.map((property) => ({ ...property, configurable: false }));
    return {
      ...state,
      extensible: false,
      frozen: properties.every((property) => !property.writable),
      properties,
      sealed: true,
    };
  }
  const empty = state.propertiesComplete && state.properties.length === 0;
  return { ...state, extensible: false, frozen: empty, sealed: empty };
};

const wrapperMethod = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput,
): "freeze" | "preventExtensions" | "seal" | null => {
  for (const method of ["freeze", "preventExtensions", "seal"] as const) {
    if (
      canonicalValueStaticGlobalTarget(environment, {
        fact: input.fact,
        globalName: "Object",
        path: [method],
        query: input.query,
      })
    ) {
      return method;
    }
  }
  return null;
};

const objectStatesForOrigin = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly origin: CanonicalValueOrigin;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<StaticObjectState> => {
  if (input.origin.kind === "absent" || input.origin.projections.length !== 0) {
    return unknownCandidateSet();
  }
  return objectStatesForExpression(environment, {
    ...input,
    expression: input.origin.expression,
  });
};

const typedArrayState = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & { readonly expression: ESTree.NewExpression },
): CandidateSet<StaticObjectState> | null => {
  const typedArrays = new Set([
    "BigInt64Array",
    "BigUint64Array",
    "DataView",
    "Float32Array",
    "Float64Array",
    "Int8Array",
    "Int16Array",
    "Int32Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Uint16Array",
    "Uint32Array",
  ]);
  const facts = environment.invocationState.facts(input.expression);
  const matches = facts.candidates.filter((fact) =>
    [...typedArrays].some(
      (name) =>
        canonicalValueStaticGlobalPropertyPath(environment.bindingIndex, {
          name,
          origin: fact.target,
        })?.length === 0,
    ),
  );
  if (matches.length === 0) return null;
  const state = { ...directObjectState(), isView: true };
  return facts.complete && matches.length === facts.candidates.length
    ? closedCandidateSet([state], objectStateKey)
    : openCandidateSet([state], objectStateKey);
};

const wrapperStates = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly expression: ESTree.CallExpression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<StaticObjectState> | null => {
  const facts = environment.invocationState.facts(input.expression);
  const resolutions = facts.candidates.flatMap((fact) => {
    const method = wrapperMethod(environment, { ...input, fact });
    if (method === null) return [];
    return [
      mapCandidateSet(
        flatMapCandidateSet(environment.invocationState.argumentOrigins(fact, 0), {
          candidateKey: objectStateKey,
          mapCandidate: (origin) => objectStatesForOrigin(environment, { ...input, origin }),
        }),
        { candidateKey: objectStateKey, mapCandidate: (state) => wrapperState(state, method) },
      ),
    ];
  });
  if (resolutions.length === 0) return null;
  const candidates = resolutions.flatMap((resolution) => resolution.candidates);
  const complete =
    facts.complete &&
    resolutions.length === facts.candidates.length &&
    resolutions.every((resolution) => resolution.complete);
  return complete
    ? closedCandidateSet(candidates, objectStateKey)
    : openCandidateSet(candidates, objectStateKey);
};

const directExpressionStates = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & { readonly expression: ESTree.Expression },
): CandidateSet<StaticObjectState> | null => {
  if (input.expression.type === "ObjectExpression") {
    return objectExpressionStates(environment, { ...input, expression: input.expression });
  }
  return input.expression.type === "ArrayExpression"
    ? closedCandidateSet([directObjectState()], objectStateKey)
    : null;
};

const constructedExpressionStates = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<StaticObjectState> | null => {
  if (input.expression.type === "NewExpression") {
    return typedArrayState(environment, { ...input, expression: input.expression });
  }
  return input.expression.type === "CallExpression"
    ? wrapperStates(environment, { ...input, expression: input.expression })
    : null;
};

export const objectStatesForExpression = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticResolutionContext & {
    readonly expression: ESTree.Expression;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): CandidateSet<StaticObjectState> => {
  const expression = unwrapExpression(input.expression);
  if (input.seen.has(expression)) return unknownCandidateSet();
  const seen = new Set([...input.seen, expression]);
  const direct = directExpressionStates(environment, { ...input, expression });
  if (direct !== null) return direct;
  return (
    constructedExpressionStates(environment, { ...input, expression, seen }) ??
    unknownCandidateSet()
  );
};

export const argumentObjectStates = (
  environment: CanonicalValueStaticInvocationEnvironment,
  input: CanonicalValueStaticInvocationInput & { readonly index: number },
): CandidateSet<StaticObjectState> => {
  const argument = canonicalValueArgumentExpression(
    canonicalValueLogicalInvocationArguments(input.fact)?.[input.index],
  );
  if (argument !== null) {
    const direct = objectStatesForExpression(environment, {
      ...input,
      expression: argument,
      seen: new Set(),
    });
    if (direct.candidates.length !== 0) return direct;
  }
  return flatMapCandidateSet(environment.invocationState.argumentOrigins(input.fact, input.index), {
    candidateKey: objectStateKey,
    mapCandidate: (origin) =>
      objectStatesForOrigin(environment, { ...input, origin, seen: new Set() }),
  });
};
