import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  invocationSources,
  numericCandidates,
  optionalNumericCandidates,
  scalarFacts,
} from "./canonical-value-collection-mutation-domain.ts";
import { popCanonicalValueInvocationProperty } from "./canonical-value-invocation-normalization.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCollectionMutationSinkEnvironment,
  MutationOperationPayload,
} from "./canonical-value-collection-mutation-types.ts";
import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";
import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";

const arrayMethods = new Set(["copyWithin", "fill", "pop", "push", "shift", "splice", "unshift"]);

export const canonicalValueArrayMethodOf = (
  origin: CanonicalValueExpressionOrigin,
): { readonly method: string; readonly receiver: CanonicalValueExpressionOrigin } | null => {
  for (const method of arrayMethods) {
    const receiver = popCanonicalValueInvocationProperty(origin, method);
    if (receiver !== null) return { method, receiver };
  }
  return null;
};

export const directCanonicalValueArrayMethod = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  node: ESTree.CallExpression,
): { readonly member: ESTree.MemberExpression; readonly method: string } | null => {
  const callee = unwrapExpression(node.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return null;
  const keys = environment.propertyState.propertyKeys({
    computed: callee.computed,
    key: callee.property,
  });
  const [method] = keys.candidates;
  if (
    !keys.complete ||
    method === undefined ||
    keys.candidates.some((key) => key !== method) ||
    !arrayMethods.has(method)
  ) {
    return null;
  }
  return { member: callee, method };
};

const fillOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly definite: boolean;
    readonly fact: CanonicalValueInvocationFact;
    readonly node: ESTree.CallExpression;
  },
): MutationOperationPayload => ({
  definite: input.definite,
  ends: optionalNumericCandidates(environment, {
    node: input.node,
    origins: environment.invocationState.argumentOrigins(input.fact, 2),
  }),
  kind: "array-fill",
  node: input.node,
  source: scalarFacts(environment, {
    node: input.node,
    origins: environment.invocationState.argumentOrigins(input.fact, 0),
  }),
  starts: optionalNumericCandidates(environment, {
    node: input.node,
    origins: environment.invocationState.argumentOrigins(input.fact, 1),
  }),
});

const copyWithinOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly definite: boolean;
    readonly fact: CanonicalValueInvocationFact;
    readonly node: ESTree.CallExpression;
  },
): MutationOperationPayload => ({
  definite: input.definite,
  ends: optionalNumericCandidates(environment, {
    node: input.node,
    origins: environment.invocationState.argumentOrigins(input.fact, 2),
  }),
  kind: "array-copy-within",
  node: input.node,
  starts: numericCandidates(environment, {
    node: input.node,
    origins: environment.invocationState.argumentOrigins(input.fact, 1),
  }),
  targets: numericCandidates(environment, {
    node: input.node,
    origins: environment.invocationState.argumentOrigins(input.fact, 0),
  }),
});

export const canonicalValueArrayOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly definite: boolean;
    readonly fact: CanonicalValueInvocationFact;
    readonly method: string;
    readonly node: ESTree.CallExpression;
  },
): MutationOperationPayload => {
  if (input.method === "copyWithin") return copyWithinOperation(environment, input);
  if (input.method === "fill") return fillOperation(environment, input);
  if (input.method === "pop" || input.method === "shift") {
    return {
      definite: input.definite,
      kind: "array-remove",
      method: input.method,
      node: input.node,
    };
  }
  if (input.method !== "splice") {
    return {
      definite: input.definite,
      kind: "array-insert",
      method: input.method,
      node: input.node,
      source: invocationSources(environment, { ...input, startIndex: 0 }),
    };
  }
  return {
    definite: input.definite,
    deleteCounts: optionalNumericCandidates(environment, {
      node: input.node,
      origins: environment.invocationState.argumentOrigins(input.fact, 1),
    }),
    kind: "array-splice",
    node: input.node,
    source: invocationSources(environment, { ...input, startIndex: 2 }),
    starts: numericCandidates(environment, {
      node: input.node,
      origins: environment.invocationState.argumentOrigins(input.fact, 0),
    }),
  };
};
