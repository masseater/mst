import {
  canonicalValueArrayMethodOf,
  canonicalValueArrayOperation,
  directCanonicalValueArrayMethod,
} from "./canonical-value-array-mutation.ts";
import {
  recordCanonicalValueAssignmentOperations,
  recordCanonicalValueDeleteOperation,
} from "./canonical-value-collection-assignment-mutation.ts";
import { scalarFacts, setReceiverOrigins } from "./canonical-value-collection-mutation-domain.ts";
import {
  addMutationOperation,
  cachedMutationReceiverOrigins,
  type CanonicalValueMutationEvaluation,
} from "./canonical-value-collection-mutation-group.ts";
import { recordCanonicalValueUpdateOperation } from "./canonical-value-collection-update-mutation.ts";
import {
  canonicalValueMutationExecutions,
  reportCanonicalValueMutationGroupAtSinks,
  type CanonicalValueMutationExecution,
} from "./canonical-value-mutation-execution.ts";
import { recordCanonicalValueStandardPropertyMutations } from "./canonical-value-standard-property-mutation.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CandidateSet } from "../lib/canonical-values/candidate-set.ts";
import type {
  CanonicalValueCollectionMutationSink,
  CanonicalValueCollectionMutationSinkEnvironment,
  MutationGroup,
  MutationOperationPayload,
} from "./canonical-value-collection-mutation-types.ts";
import type {
  CanonicalValueInvocationFact,
  CanonicalValueRecognizedInvocation,
} from "./canonical-value-invocation.ts";
import type { CanonicalValueExpressionOrigin } from "./canonical-value-property-origin.ts";

const setOperation = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: {
    readonly definite: boolean;
    readonly invocation: CanonicalValueRecognizedInvocation;
    readonly node: ESTree.CallExpression;
  },
): MutationOperationPayload | null => {
  const kind = input.invocation.target.kind;
  if (kind === "set-clear") {
    return { definite: input.definite, kind, node: input.node };
  }
  if (kind !== "set-add" && kind !== "set-delete") return null;
  return {
    definite: input.definite,
    kind,
    node: input.node,
    source: scalarFacts(environment, {
      node: input.node,
      origins: environment.invocationState.argumentOrigins(input.invocation, 0),
    }),
  };
};

const addSetInvocationOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly executions: readonly CanonicalValueMutationExecution[];
    readonly invocation: CanonicalValueRecognizedInvocation;
    readonly node: ESTree.CallExpression;
  },
): void => {
  const receivers = setReceiverOrigins(environment, input.invocation);
  for (const origin of receivers.candidates) {
    for (const execution of input.executions) {
      const operation = setOperation(environment, {
        definite: execution.definite,
        invocation: input.invocation,
        node: input.node,
      });
      if (operation === null) continue;
      addMutationOperation(input.groups, {
        operation: { ...operation, order: execution.order },
        origin,
        set: true,
      });
    }
  }
};

const setOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & { readonly node: ESTree.CallExpression },
): void => {
  const executions = canonicalValueMutationExecutions(environment, input);
  if (executions.length === 0) return;
  const recognized = environment.invocationState.recognized(input.node);
  for (const invocation of recognized.candidates) {
    addSetInvocationOperations(environment, { ...input, executions, invocation });
  }
};

const directArrayCallOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly execution: CanonicalValueMutationExecution;
    readonly node: ESTree.CallExpression;
  },
): boolean => {
  const method = directCanonicalValueArrayMethod(environment, input.node);
  if (method === null || method.member.object.type === "Super") return false;
  const receivers = cachedMutationReceiverOrigins(environment, {
    cache: input.receiverCache,
    expression: method.member.object,
  });
  for (const origin of receivers.candidates) {
    const fact: CanonicalValueInvocationFact = {
      argumentSegments:
        input.node.arguments.length === 0
          ? []
          : [{ elements: input.node.arguments, kind: "direct" }],
      target: origin,
      thisArgument: method.member.object,
    };
    addMutationOperation(input.groups, {
      operation: {
        ...canonicalValueArrayOperation(environment, {
          definite: input.execution.definite,
          fact,
          method: method.method,
          node: input.node,
        }),
        order: input.execution.order,
      },
      origin,
      set: false,
    });
  }
  return true;
};

const normalizedArrayFactOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & {
    readonly executions: readonly CanonicalValueMutationExecution[];
    readonly fact: CanonicalValueInvocationFact;
    readonly node: ESTree.CallExpression;
  },
): void => {
  const method = canonicalValueArrayMethodOf(input.fact.target);
  if (method === null || input.fact.thisArgument === null) return;
  const receivers = cachedMutationReceiverOrigins(environment, {
    cache: input.receiverCache,
    expression: input.fact.thisArgument,
  });
  for (const origin of receivers.candidates) {
    for (const execution of input.executions) {
      addMutationOperation(input.groups, {
        operation: {
          ...canonicalValueArrayOperation(environment, {
            definite: execution.definite,
            fact: input.fact,
            method: method.method,
            node: input.node,
          }),
          order: execution.order,
        },
        origin,
        set: false,
      });
    }
  }
};

const arrayCallOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & { readonly node: ESTree.CallExpression },
): void => {
  const executions = canonicalValueMutationExecutions(environment, input);
  if (executions.length === 0) return;
  const directlyHandled = executions.every((execution) =>
    directArrayCallOperations(environment, { ...input, execution }),
  );
  if (directlyHandled) return;
  const facts = environment.invocationState.facts(input.node);
  for (const fact of facts.candidates) {
    normalizedArrayFactOperations(environment, { ...input, executions, fact });
  }
};

type CollectedMutationNodes = {
  readonly assignments: ReadonlySet<ESTree.AssignmentExpression>;
  readonly calls: ReadonlySet<ESTree.CallExpression>;
  readonly unaries: ReadonlySet<ESTree.UnaryExpression>;
  readonly updates: ReadonlySet<ESTree.UpdateExpression>;
};

const recordCollectedOperations = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CanonicalValueMutationEvaluation & CollectedMutationNodes,
): void => {
  const nodes = [...input.calls, ...input.assignments, ...input.unaries, ...input.updates].toSorted(
    (left, right) => left.start - right.start,
  );
  for (const node of nodes) {
    if (node.type === "CallExpression") {
      setOperations(environment, { ...input, node });
      arrayCallOperations(environment, { ...input, node });
      recordCanonicalValueStandardPropertyMutations(environment, { ...input, node });
    } else if (node.type === "AssignmentExpression") {
      recordCanonicalValueAssignmentOperations(environment, { ...input, node });
    } else if (node.type === "UnaryExpression") {
      recordCanonicalValueDeleteOperation(environment, { ...input, node });
    } else {
      recordCanonicalValueUpdateOperation(environment, { ...input, node });
    }
  }
};

const evaluateMutationSink = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
  input: CollectedMutationNodes & { readonly program: ESTree.Program },
): void => {
  const groups = new Map<string, MutationGroup>();
  const receiverCache = new Map<object, CandidateSet<CanonicalValueExpressionOrigin>>();
  recordCollectedOperations(environment, { ...input, groups, receiverCache });
  for (const group of groups.values()) {
    reportCanonicalValueMutationGroupAtSinks(environment, {
      calls: input.calls,
      group,
      program: input.program,
    });
  }
};

export const createCanonicalValueCollectionMutationSink = (
  environment: CanonicalValueCollectionMutationSinkEnvironment,
): CanonicalValueCollectionMutationSink => {
  const assignments = new Set<ESTree.AssignmentExpression>();
  const calls = new Set<ESTree.CallExpression>();
  const unaries = new Set<ESTree.UnaryExpression>();
  const updates = new Set<ESTree.UpdateExpression>();
  return {
    evaluate: (program) => {
      evaluateMutationSink(environment, { assignments, calls, program, unaries, updates });
    },
    recordAssignment: (node) => {
      assignments.add(node);
    },
    recordCall: (node) => {
      calls.add(node);
    },
    recordUnary: (node) => {
      unaries.add(node);
    },
    recordUpdate: (node) => {
      updates.add(node);
    },
  };
};

export type {
  CanonicalValueCollectionMutationSink,
  CanonicalValueCollectionMutationSinkEnvironment,
} from "./canonical-value-collection-mutation-types.ts";
