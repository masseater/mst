import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { scalarFacts } from "./canonical-value-collection-mutation-domain.ts";
import {
  addMutationOperation,
  cachedMutationReceiverOrigins,
  type CanonicalValueMutationEvaluation,
} from "./canonical-value-collection-mutation-group.ts";
import { recordCanonicalValueAssignmentDelta } from "./canonical-value-collection-update-mutation.ts";
import { canonicalValueMutationExecutions } from "./canonical-value-mutation-execution.ts";
import { canonicalValueArrayIndexOf } from "./canonical-value-property-collection.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type { CanonicalValueCollectionMutationSinkEnvironment } from "./canonical-value-collection-mutation-types.ts";

const assignmentTargetMember = (
  target: ESTree.AssignmentTarget,
): ESTree.MemberExpression | null => {
  if (target.type === "MemberExpression") return target;
  if (
    target.type !== "TSAsExpression" &&
    target.type !== "TSNonNullExpression" &&
    target.type !== "TSSatisfiesExpression" &&
    target.type !== "TSTypeAssertion"
  ) {
    return null;
  }
  const expression = unwrapExpression(target.expression);
  return expression.type === "MemberExpression" ? expression : null;
};

const assignmentMember = (
  assignment: ESTree.AssignmentExpression,
): ESTree.MemberExpression | null => assignmentTargetMember(assignment.left);

const memberIndexes = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: { readonly member: ESTree.MemberExpression; readonly node: ESTree.Expression },
): CandidateSet<number> => {
  const keys = environment.propertyState.propertyKeys({
    computed: input.member.computed,
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    key: input.member.property,
  });
  const indexes = keys.candidates.flatMap((key) => {
    const index = canonicalValueArrayIndexOf(key);
    return index === null ? [] : [index];
  });
  return {
    candidates: indexes,
    complete: keys.complete && indexes.length === keys.candidates.length,
  };
};

const addAssignmentOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly definite: boolean;
    readonly member: ESTree.MemberExpression;
    readonly node: ESTree.AssignmentExpression;
    readonly order: readonly number[];
    readonly sourceExpression?: ESTree.Expression;
    readonly sourcePath?: readonly string[];
  },
): void => {
  const indexes = memberIndexes(environment, input);
  if (indexes.candidates.length === 0 || input.member.object.type === "Super") return;
  const source = scalarFacts(environment, {
    node: input.node,
    origins: environment.propertyState.origins({
      cutoff: input.node.start,
      executionContext: environment.bindingIndex.executionContextAt(input.node),
      expression: input.sourceExpression ?? input.node.right,
      path: input.sourcePath,
    }),
  });
  const receivers = cachedMutationReceiverOrigins(environment, {
    cache: input.receiverCache,
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    expression: input.member.object,
  });
  for (const origin of receivers.candidates) {
    addMutationOperation(input.groups, {
      operation: {
        definite: input.definite,
        indexes,
        kind: "array-index",
        node: input.node,
        order: input.order,
        source,
      },
      origin,
      set: false,
    });
  }
};

const addLogicalAssignmentOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly definite: boolean;
    readonly member: ESTree.MemberExpression;
    readonly node: ESTree.AssignmentExpression;
    readonly operator: "&&=" | "??=" | "||=";
    readonly order: readonly number[];
  },
): void => {
  const indexes = memberIndexes(environment, input);
  if (indexes.candidates.length === 0 || input.member.object.type === "Super") return;
  const source = scalarFacts(environment, {
    node: input.node,
    origins: environment.propertyState.origins({
      cutoff: input.node.start,
      executionContext: environment.bindingIndex.executionContextAt(input.node),
      expression: input.node.right,
    }),
  });
  const receivers = cachedMutationReceiverOrigins(environment, {
    cache: input.receiverCache,
    expression: input.member.object,
  });
  for (const origin of receivers.candidates) {
    addMutationOperation(input.groups, {
      operation: {
        definite: input.definite,
        indexes,
        kind: "array-logical-index",
        node: input.node,
        operator: input.operator,
        order: input.order,
        source,
      },
      origin,
      set: false,
    });
  }
};

const patternMember = (
  element: ESTree.ArrayAssignmentTarget["elements"][number],
): ESTree.MemberExpression | null => {
  if (element === null) return null;
  const target =
    element.type === "RestElement"
      ? element.argument
      : element.type === "AssignmentPattern"
        ? element.left
        : element;
  return assignmentTargetMember(target);
};

const recordArrayPatternAssignments = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly node: ESTree.AssignmentExpression;
    readonly pattern: ESTree.ArrayAssignmentTarget;
  },
): void => {
  const executions = canonicalValueMutationExecutions(environment, input);
  const source = unwrapExpression(input.node.right);
  for (const [index, element] of input.pattern.elements.entries()) {
    const member = patternMember(element);
    if (member === null) continue;
    const directSource = source.type === "ArrayExpression" ? source.elements[index] : undefined;
    const sourceExpression =
      directSource !== undefined && directSource !== null && directSource.type !== "SpreadElement"
        ? directSource
        : input.node.right;
    const sourcePath = sourceExpression === input.node.right ? [String(index)] : undefined;
    for (const execution of executions) {
      addAssignmentOperation(environment, {
        ...input,
        definite: execution.definite,
        member,
        order: [...execution.order, index],
        sourceExpression,
        sourcePath,
      });
    }
  }
};

const arrayLengths = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  node: ESTree.AssignmentExpression,
): CandidateSet<number> => {
  const primitives = environment.propertyState.primitives({
    cutoff: node.start,
    executionContext: environment.bindingIndex.executionContextAt(node),
    expression: node.right,
  });
  const lengths = primitives.candidates
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 4_294_967_295);
  return {
    candidates: lengths,
    complete: primitives.complete && lengths.length === primitives.candidates.length,
  };
};

const addLengthOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly member: ESTree.MemberExpression;
    readonly node: ESTree.AssignmentExpression;
  },
): boolean => {
  const keys = environment.propertyState.propertyKeys({
    computed: input.member.computed,
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    key: input.member.property,
  });
  const lengths = arrayLengths(environment, input.node);
  if (
    !keys.complete ||
    keys.candidates.length !== 1 ||
    keys.candidates[0] !== "length" ||
    lengths.candidates.length === 0 ||
    input.member.object.type === "Super"
  ) {
    return false;
  }
  const receivers = cachedMutationReceiverOrigins(environment, {
    cache: input.receiverCache,
    expression: input.member.object,
  });
  const executions = canonicalValueMutationExecutions(environment, input);
  for (const origin of receivers.candidates) {
    for (const execution of executions) {
      addMutationOperation(input.groups, {
        operation: {
          definite: execution.definite,
          kind: "array-truncate",
          lengths,
          node: input.node,
          order: execution.order,
        },
        origin,
        set: false,
      });
    }
  }
  return true;
};

const recordLogicalAssignmentOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly member: ESTree.MemberExpression;
    readonly node: ESTree.AssignmentExpression;
  },
): boolean => {
  if (
    input.node.operator !== "&&=" &&
    input.node.operator !== "??=" &&
    input.node.operator !== "||="
  ) {
    return false;
  }
  const operator = input.node.operator;
  const executions = canonicalValueMutationExecutions(environment, input);
  for (const execution of executions) {
    addLogicalAssignmentOperation(environment, {
      ...input,
      definite: execution.definite,
      operator,
      order: execution.order,
    });
  }
  return true;
};

const recordDirectAssignmentOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly member: ESTree.MemberExpression;
    readonly node: ESTree.AssignmentExpression;
  },
): void => {
  if (input.node.operator !== "=") return;
  if (addLengthOperations(environment, input)) return;
  const executions = canonicalValueMutationExecutions(environment, input);
  for (const execution of executions) {
    addAssignmentOperation(environment, {
      ...input,
      definite: execution.definite,
      order: execution.order,
    });
  }
};

export const recordCanonicalValueAssignmentOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & { readonly node: ESTree.AssignmentExpression },
): void => {
  const member = assignmentMember(input.node);
  if (member === null) {
    if (input.node.operator === "=" && input.node.left.type === "ArrayPattern") {
      recordArrayPatternAssignments(environment, { ...input, pattern: input.node.left });
    }
    return;
  }
  const memberInput = { ...input, member };
  if (recordCanonicalValueAssignmentDelta(environment, memberInput)) return;
  if (recordLogicalAssignmentOperations(environment, memberInput)) return;
  recordDirectAssignmentOperations(environment, memberInput);
};

export const recordCanonicalValueDeleteOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & { readonly node: ESTree.UnaryExpression },
): void => {
  if (input.node.operator !== "delete") return;
  const argument = unwrapExpression(input.node.argument);
  if (argument.type !== "MemberExpression" || argument.object.type === "Super") return;
  const indexes = memberIndexes(environment, { member: argument, node: input.node });
  if (indexes.candidates.length === 0) return;
  const receivers = cachedMutationReceiverOrigins(environment, {
    cache: input.receiverCache,
    cutoff: input.node.start,
    executionContext: environment.bindingIndex.executionContextAt(input.node),
    expression: argument.object,
  });
  const executions = canonicalValueMutationExecutions(environment, input);
  for (const origin of receivers.candidates) {
    for (const execution of executions) {
      addMutationOperation(input.groups, {
        operation: {
          definite: execution.definite,
          indexes,
          kind: "array-delete",
          node: input.node,
          order: execution.order,
        },
        origin,
        set: false,
      });
    }
  }
};
