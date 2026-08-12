import { numericCandidates, scalarFacts } from "./canonical-value-collection-mutation-domain.ts";
import {
  addMutationOperation,
  type CanonicalValueMutationEvaluation,
} from "./canonical-value-collection-mutation-group.ts";
import { canonicalValueMutationExecutions } from "./canonical-value-mutation-execution.ts";
import { canonicalValueArrayIndexOf } from "./canonical-value-property-collection.ts";
import {
  canonicalValueStandardPropertyMutationFacts,
  type CanonicalValueStandardPropertyMutationFact,
} from "./canonical-value-standard-property-mutation-fact.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValueCollectionMutationSinkEnvironment } from "./canonical-value-collection-mutation-types.ts";
import type { CanonicalValueInvocationFact } from "./canonical-value-invocation.ts";
import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";

const mutationReceivers = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  fact: CanonicalValueInvocationFact,
): readonly CanonicalValueExpressionOrigin[] =>
  environment.invocationState
    .argumentOrigins(fact, 0)
    .candidates.filter(
      (origin): origin is CanonicalValueExpressionOrigin => origin.kind === "expression",
    );

const mutationIndexes = (
  mutation: CanonicalValueStandardPropertyMutationFact,
): CandidateSet<number> => {
  const indexes = mutation.keys.candidates.flatMap((key) => {
    const index = canonicalValueArrayIndexOf(key);
    return index === null ? [] : [index];
  });
  return {
    candidates: indexes,
    complete: mutation.keys.complete && indexes.length === mutation.keys.candidates.length,
  };
};

const addOpaqueOperation = (
  input: CanonicalValueMutationEvaluation & {
    readonly definite: boolean;
    readonly node: ESTree.CallExpression;
    readonly order: readonly number[];
    readonly origin: CanonicalValueExpressionOrigin;
  },
): void => {
  addMutationOperation(input.groups, {
    operation: {
      definite: input.definite,
      kind: "array-opaque",
      node: input.node,
      order: input.order,
    },
    origin: input.origin,
    set: false,
  });
};

const addDeleteOperation = (
  input: CanonicalValueMutationEvaluation & {
    readonly definite: boolean;
    readonly indexes: CandidateSet<number>;
    readonly node: ESTree.CallExpression;
    readonly order: readonly number[];
    readonly origin: CanonicalValueExpressionOrigin;
  },
): void => {
  addMutationOperation(input.groups, {
    operation: {
      definite: input.definite,
      indexes: input.indexes,
      kind: "array-delete",
      node: input.node,
      order: input.order,
    },
    origin: input.origin,
    set: false,
  });
};

const addWriteOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly definite: boolean;
    readonly indexes: CandidateSet<number>;
    readonly mutation: Extract<
      CanonicalValueStandardPropertyMutationFact,
      { readonly operation: "write" }
    >;
    readonly node: ESTree.CallExpression;
    readonly order: readonly number[];
    readonly origin: CanonicalValueExpressionOrigin;
  },
): void => {
  const lengths = numericCandidates(environment, {
    node: input.node,
    origins: input.mutation.valueOrigins,
  });
  const source = scalarFacts(environment, {
    node: input.node,
    origins: input.mutation.valueOrigins,
  });
  if (input.mutation.keys.candidates.includes("length") && lengths.candidates.length !== 0) {
    addMutationOperation(input.groups, {
      operation: {
        definite: input.definite,
        kind: "array-truncate",
        lengths,
        node: input.node,
        order: input.order,
      },
      origin: input.origin,
      set: false,
    });
  }
  if (input.indexes.candidates.length !== 0 && source.candidates.length !== 0) {
    addMutationOperation(input.groups, {
      operation: {
        definite: input.definite,
        indexes: input.indexes,
        kind: "array-index",
        node: input.node,
        order: input.order,
        source,
      },
      origin: input.origin,
      set: false,
    });
  }
  const unresolvedLength =
    input.mutation.keys.candidates.includes("length") && lengths.candidates.length === 0;
  const unresolvedIndex = input.indexes.candidates.length !== 0 && source.candidates.length === 0;
  if (unresolvedLength || unresolvedIndex) addOpaqueOperation(input);
};

const addPropertyMutationExecution = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly definite: boolean;
    readonly mutation: CanonicalValueStandardPropertyMutationFact;
    readonly node: ESTree.CallExpression;
    readonly order: readonly number[];
    readonly origin: CanonicalValueExpressionOrigin;
  },
): void => {
  const indexes = mutationIndexes(input.mutation);
  if (input.mutation.operation === "opaque" || !input.mutation.keys.complete) {
    addOpaqueOperation(input);
  }
  if (input.mutation.operation === "delete" && indexes.candidates.length !== 0) {
    addDeleteOperation({ ...input, indexes });
  }
  if (input.mutation.operation === "write") {
    addWriteOperations(environment, { ...input, indexes, mutation: input.mutation });
  }
};

const addPropertyMutationOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly fact: CanonicalValueInvocationFact;
    readonly mutation: CanonicalValueStandardPropertyMutationFact;
    readonly node: ESTree.CallExpression;
  },
): void => {
  const executions = canonicalValueMutationExecutions(environment, input);
  for (const origin of mutationReceivers(environment, input.fact)) {
    for (const execution of executions) {
      addPropertyMutationExecution(environment, { ...input, ...execution, origin });
    }
  }
};

export const recordCanonicalValueStandardPropertyMutations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & { readonly node: ESTree.CallExpression },
): void => {
  for (const { fact, mutation } of canonicalValueStandardPropertyMutationFacts(
    environment,
    input.node,
  )) {
    addPropertyMutationOperations(environment, { ...input, fact, mutation });
  }
};

export { canonicalValueStandardPropertyMutationFacts } from "./canonical-value-standard-property-mutation-fact.ts";
