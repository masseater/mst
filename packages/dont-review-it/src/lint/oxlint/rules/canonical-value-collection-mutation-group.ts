import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { receiverOrigins } from "./canonical-value-collection-mutation-domain.ts";
import {
  canonicalValueOriginKey,
  type CanonicalValueExpressionOrigin,
} from "./canonical-value-property-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValueExecutionContext } from "./canonical-value-binding-index.ts";
import type {
  CanonicalValueCollectionMutationSinkEnvironment,
  MutationGroup,
  MutationOperation,
} from "./canonical-value-collection-mutation-types.ts";

export type CanonicalValueMutationEvaluation = {
  readonly groups: Map<string, MutationGroup>;
  readonly program: ESTree.Program;
  readonly receiverCache: Map<object, CandidateSet<CanonicalValueExpressionOrigin>>;
};

export const cachedMutationReceiverOrigins = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly cache: Map<object, CandidateSet<CanonicalValueExpressionOrigin>>;
    readonly cutoff?: number;
    readonly executionContext?: CanonicalValueExecutionContext;
    readonly expression: ESTree.Expression;
  },
): CandidateSet<CanonicalValueExpressionOrigin> => {
  const expression = unwrapExpression(input.expression);
  if (input.cutoff !== undefined) {
    return receiverOrigins(environment, {
      cutoff: input.cutoff,
      executionContext: input.executionContext,
      expression,
    });
  }
  const identity =
    expression.type === "Identifier"
      ? (environment.bindingIndex.resolveIdentifier(expression) ?? expression)
      : expression;
  const cached = input.cache.get(identity);
  if (cached !== undefined) return cached;
  const origins = receiverOrigins(environment, { expression });
  input.cache.set(identity, origins);
  return origins;
};

export const addMutationOperation = (
  groups: Map<string, MutationGroup>,
  input: {
    readonly operation: MutationOperation;
    readonly origin: CanonicalValueExpressionOrigin;
    readonly set: boolean;
  },
): void => {
  const key = `${String(input.set)}:${canonicalValueOriginKey(input.origin)}`;
  const existing = groups.get(key);
  if (existing === undefined) {
    groups.set(key, { operations: [input.operation], origin: input.origin, set: input.set });
    return;
  }
  existing.operations.push(input.operation);
};
