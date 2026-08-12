import { canonicalValueOccurrenceOrder } from "./canonical-value-binding-execution.ts";
import {
  compareCanonicalValueMutationOrders,
  reportMutationGroup,
} from "./canonical-value-collection-mutation-state.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCollectionMutationSinkEnvironment,
  MutationGroup,
  MutationOperation,
} from "./canonical-value-collection-mutation-types.ts";

export type CanonicalValueMutationExecution = {
  readonly definite: boolean;
  readonly order: readonly number[];
};

const callSitesExecution = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  callSites: readonly ESTree.Node[],
): { readonly definite: boolean; readonly executes: boolean } => {
  const executions = callSites.map((callSite) => environment.propertyState.execution(callSite));
  return {
    definite: executions.every((execution) => execution.definite && execution.executes),
    executes: executions.every((execution) => !execution.definite || execution.executes),
  };
};

export const canonicalValueMutationExecutions = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly node:
      | ESTree.AssignmentExpression
      | ESTree.CallExpression
      | ESTree.UnaryExpression
      | ESTree.UpdateExpression;
    readonly program: ESTree.Program;
  },
): readonly CanonicalValueMutationExecution[] => {
  const nodeExecution = environment.propertyState.execution(input.node);
  if (nodeExecution.definite && !nodeExecution.executes) return [];
  const occurrences = environment.bindingIndex.executionOccurrencesOf(input.node, {
    cutoff: input.program.end,
    executionContext: environment.bindingIndex.executionContextAt(input.program),
  });
  return occurrences.flatMap((occurrence) => {
    const callSites = callSitesExecution(environment, occurrence.callSites);
    return callSites.executes
      ? [
          {
            definite: nodeExecution.definite && nodeExecution.executes && callSites.definite,
            order: canonicalValueOccurrenceOrder(occurrence, input.node),
          },
        ]
      : [];
  });
};

const invocationReadsOrigin = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly node: ESTree.CallExpression;
    readonly originKey: string;
  },
): boolean => {
  for (const invocation of environment.invocationState.recognized(input.node).candidates) {
    if (invocation.target.kind !== "schema") continue;
    const origins = environment.invocationState.argumentOrigins(invocation, 0);
    for (const origin of origins.candidates) {
      if (canonicalValueOriginKey(origin) === input.originKey) return true;
    }
  }
  return false;
};

const mutationGroupSinkOrders = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly calls: ReadonlySet<ESTree.CallExpression>;
    readonly origin: CanonicalValueExpressionOrigin;
    readonly program: ESTree.Program;
  },
): readonly (readonly number[])[] => {
  const originKey = canonicalValueOriginKey(input.origin);
  const orders = [...input.calls].flatMap((node) =>
    invocationExecutionOrders(environment, { node, originKey, program: input.program }),
  );
  return orders.length === 0 ? [[input.program.end]] : orders;
};

const invocationExecutionOrders = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly node: ESTree.CallExpression;
    readonly originKey: string;
    readonly program: ESTree.Program;
  },
): readonly (readonly number[])[] =>
  invocationReadsOrigin(environment, input)
    ? canonicalValueMutationExecutions(environment, input).map((execution) => execution.order)
    : [];

const operationsBefore = (
  operations: readonly MutationOperation[],
  order: readonly number[],
): MutationOperation[] =>
  operations.filter((operation) => compareCanonicalValueMutationOrders(operation.order, order) < 0);

export const reportCanonicalValueMutationGroupAtSinks = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly calls: ReadonlySet<ESTree.CallExpression>;
    readonly group: MutationGroup;
    readonly program: ESTree.Program;
  },
): void => {
  const orders = mutationGroupSinkOrders(environment, {
    calls: input.calls,
    origin: input.group.origin,
    program: input.program,
  });
  for (const order of orders) {
    reportMutationGroup(environment, {
      ...input.group,
      operations: operationsBefore(input.group.operations, order),
    });
  }
};
