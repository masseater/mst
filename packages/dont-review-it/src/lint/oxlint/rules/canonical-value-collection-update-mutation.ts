import {
  closedCandidateSet,
  mapCandidateSet,
  type CandidateSet,
} from "../lib/canonical-values/candidate-set.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  addMutationOperation,
  cachedMutationReceiverOrigins,
  type CanonicalValueMutationEvaluation,
} from "./canonical-value-collection-mutation-group.ts";
import { canonicalValueMutationExecutions } from "./canonical-value-mutation-execution.ts";
import { canonicalValueArrayIndexOf } from "./canonical-value-property-collection.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type { CanonicalValueCollectionMutationSinkEnvironment } from "./canonical-value-collection-mutation-types.ts";

type DeltaNode = ESTree.AssignmentExpression | ESTree.UpdateExpression;

const memberKeys = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly member: ESTree.MemberExpression; readonly node: DeltaNode },
): CandidateSet<string> =>
  environment.propertyState.propertyKeys({
    computed: input.member.computed,
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    key: input.member.property,
  });

const memberIndexes = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly member: ESTree.MemberExpression; readonly node: DeltaNode },
): CandidateSet<number> => {
  const keys = memberKeys(environment, input);
  const indexes = keys.candidates.flatMap((key) => {
    const index = canonicalValueArrayIndexOf(key);
    return index === null ? [] : [index];
  });
  return {
    candidates: indexes,
    complete: keys.complete && indexes.length === keys.candidates.length,
  };
};

const memberIsLength = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly member: ESTree.MemberExpression; readonly node: DeltaNode },
): boolean => {
  const keys = memberKeys(environment, input);
  return keys.complete && keys.candidates.length === 1 && keys.candidates[0] === "length";
};

const numericCandidates = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly expression: ESTree.Expression; readonly node: DeltaNode },
): CandidateSet<number> => {
  const primitives = environment.propertyState.primitives({
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    expression: input.expression,
  });
  const numbers = primitives.candidates.map((primitive) => Number(primitive));
  return {
    candidates: numbers,
    complete: primitives.complete && numbers.length === primitives.candidates.length,
  };
};

const receiverIdentity = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  expression: ESTree.Expression,
): ESTree.Expression | Variable => {
  const unwrapped = unwrapExpression(expression);
  return unwrapped.type === "Identifier"
    ? (environment.bindingIndex.resolveIdentifier(unwrapped) ?? unwrapped)
    : unwrapped;
};

const sameReceiver = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly left: ESTree.Expression; readonly right: ESTree.Expression },
): boolean =>
  receiverIdentity(environment, input.left) === receiverIdentity(environment, input.right);

const derivedLengthDeltas = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly member: ESTree.MemberExpression;
    readonly node: ESTree.AssignmentExpression;
  },
): CandidateSet<number> | null => {
  const expression = unwrapExpression(input.node.right);
  if (expression.type !== "BinaryExpression") return null;
  if (expression.operator !== "+" && expression.operator !== "-") return null;
  const base = unwrapExpression(expression.left);
  if (base.type !== "MemberExpression" || base.object.type === "Super") return null;
  if (!memberIsLength(environment, { member: base, node: input.node })) return null;
  if (!sameReceiver(environment, { left: input.member.object, right: base.object })) return null;
  const candidates = numericCandidates(environment, {
    expression: expression.right,
    node: input.node,
  });
  return expression.operator === "+"
    ? candidates
    : mapCandidateSet(candidates, { candidateKey: String, mapCandidate: (value) => -value });
};

const compoundDeltas = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  node: ESTree.AssignmentExpression,
): CandidateSet<number> | null => {
  if (node.operator !== "+=" && node.operator !== "-=") return null;
  const candidates = numericCandidates(environment, { expression: node.right, node });
  return node.operator === "+="
    ? candidates
    : mapCandidateSet(candidates, { candidateKey: String, mapCandidate: (value) => -value });
};

const deltaTarget = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly member: ESTree.MemberExpression; readonly node: DeltaNode },
): { readonly indexes: CandidateSet<number>; readonly length: boolean } | null => {
  const length = memberIsLength(environment, input);
  const indexes = length
    ? closedCandidateSet<number>([], String)
    : memberIndexes(environment, input);
  return length || indexes.candidates.length !== 0 ? { indexes, length } : null;
};

const addDeltaOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly deltas: CandidateSet<number>;
    readonly member: ESTree.MemberExpression;
    readonly node: DeltaNode;
  },
): boolean => {
  if (input.member.object.type === "Super" || input.deltas.candidates.length === 0) return false;
  const target = deltaTarget(environment, input);
  if (target === null) return false;
  const receivers = cachedMutationReceiverOrigins(environment, {
    cache: input.receiverCache,
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    expression: input.member.object,
  });
  const executions = canonicalValueMutationExecutions(environment, input);
  for (const origin of receivers.candidates) {
    for (const execution of executions) {
      const operation = target.length
        ? {
            definite: execution.definite,
            deltas: input.deltas,
            kind: "array-length-delta" as const,
            node: input.node,
            order: execution.order,
          }
        : {
            definite: execution.definite,
            deltas: input.deltas,
            indexes: target.indexes,
            kind: "array-index-delta" as const,
            node: input.node,
            order: execution.order,
          };
      addMutationOperation(input.groups, { operation, origin, set: false });
    }
  }
  return true;
};

export const recordCanonicalValueAssignmentDelta = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly member: ESTree.MemberExpression;
    readonly node: ESTree.AssignmentExpression;
  },
): boolean => {
  const deltas =
    input.node.operator === "="
      ? derivedLengthDeltas(environment, input)
      : compoundDeltas(environment, input.node);
  return deltas === null ? false : addDeltaOperations(environment, { ...input, deltas });
};

export const recordCanonicalValueUpdateOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & { readonly node: ESTree.UpdateExpression },
): void => {
  const argument = unwrapExpression(input.node.argument);
  if (argument.type !== "MemberExpression") return;
  addDeltaOperations(environment, {
    ...input,
    deltas: closedCandidateSet([input.node.operator === "++" ? 1 : -1], String),
    member: argument,
  });
};
