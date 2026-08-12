import { createCanonicalValueBindingCallFinalizer } from "./canonical-value-binding-call-finalizer.ts";
import {
  canonicalValueIsFunctionNode,
  createCanonicalValueExecutionIndex,
  type CanonicalValueExecutionIndex,
} from "./canonical-value-binding-execution.ts";
import { createCanonicalValueGlobalWriteRecorders } from "./canonical-value-binding-global-write.ts";
import { createCanonicalValueBindingInvocationRecorder } from "./canonical-value-binding-invocation.ts";
import {
  canonicalValueForInSources,
  canonicalValueForOfSources,
} from "./canonical-value-binding-iteration.ts";
import {
  canonicalValueBindingCallReturns,
  canonicalValueBindingCallYields,
  canonicalValueBindingCollectionCallbackReturns,
  canonicalValueBindingCollectionCallbackResults,
  canonicalValueBindingIterableYields,
} from "./canonical-value-binding-result-query.ts";
import { createCanonicalValueBindingReturnIndex } from "./canonical-value-binding-return.ts";
import {
  canonicalValueWriteSuppliesValue,
  type CanonicalValueCallArgumentOccurrence,
  type CanonicalValueBindingIndex,
  type CanonicalValueBindingWrite,
  type CanonicalValueIdentifier,
  type CanonicalValueMemberWrite,
} from "./canonical-value-binding-types.ts";
import { filterCanonicalValueWrites } from "./canonical-value-binding-write-query.ts";
import {
  canonicalValueUnwrapAssignmentTarget,
  recordCanonicalValueTarget,
  type CanonicalValueRecordTargetInput,
} from "./canonical-value-binding-write-recorder.ts";
import { createCanonicalValueGlobalWriteIndex } from "./canonical-value-global-write.ts";
import { bindingInScope } from "./scope-resolution.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSource } from "./canonical-value-call-arguments.ts";

export type * from "./canonical-value-binding-types.ts";
export { canonicalValuePropertyKeyOf } from "./canonical-value-property-key.ts";

type BindingIndexState = {
  readonly bindingWrites: Map<Variable, readonly CanonicalValueBindingWrite[]>;
  readonly callArguments: Map<
    ESTree.ArrowFunctionExpression | ESTree.Function,
    readonly CanonicalValueCallArgumentOccurrence[]
  >;
  readonly executionIndex: CanonicalValueExecutionIndex;
  readonly memberWrites: Map<Variable, readonly CanonicalValueMemberWrite[]>;
  readonly resolvedIdentifiers: WeakMap<ESTree.Node, Variable | null>;
  readonly sourceCode: Pick<SourceCode, "getAncestors" | "getScope" | "scopeManager">;
};

const uncachedIdentifierResolution = (
  state: BindingIndexState,
  identifier: CanonicalValueIdentifier,
): Variable | null => {
  const reference = state.sourceCode.scopeManager.scopes
    .flatMap((scope) => scope.references)
    .find((candidate) => candidate.identifier === identifier);
  if (reference !== undefined) return reference.resolved;
  const declaration = state.sourceCode.scopeManager.scopes
    .flatMap((scope) => scope.variables)
    .find((variable) => variable.identifiers.includes(identifier));
  return declaration ?? bindingInScope(state.sourceCode.getScope(identifier), identifier.name);
};

const resolveIdentifier = (
  state: BindingIndexState,
  identifier: CanonicalValueIdentifier,
): Variable | null => {
  if (state.resolvedIdentifiers.has(identifier)) {
    return state.resolvedIdentifiers.get(identifier) ?? null;
  }
  const resolved = uncachedIdentifierResolution(state, identifier);
  state.resolvedIdentifiers.set(identifier, resolved);
  return resolved;
};

const callArgumentOccurrencesOf = (
  state: BindingIndexState,
  identifier: ESTree.IdentifierReference,
): readonly CanonicalValueCallArgumentOccurrence[] => {
  const binding = resolveIdentifier(state, identifier);
  if (binding?.name !== "arguments" || binding.defs.length !== 0) return [];
  const owner = binding.scope.block;
  if (!canonicalValueIsFunctionNode(owner)) return [];
  return (state.callArguments.get(owner) ?? []).filter((occurrence) =>
    state.executionIndex.invocationExecutes({ callee: owner, node: occurrence.invocation }),
  );
};

const recordTarget = (state: BindingIndexState, input: CanonicalValueRecordTargetInput): void => {
  recordCanonicalValueTarget(
    {
      bindingWrites: state.bindingWrites,
      executionIndex: state.executionIndex,
      memberWrites: state.memberWrites,
      resolveIdentifier: (identifier) => resolveIdentifier(state, identifier),
    },
    input,
  );
};

const aliasSources = (
  state: BindingIndexState,
  identifier: ESTree.IdentifierReference,
): readonly ESTree.Expression[] => {
  const binding = resolveIdentifier(state, identifier);
  if (binding === null) return [];
  return (state.bindingWrites.get(binding) ?? [])
    .filter((write) => write.start < identifier.start && canonicalValueWriteSuppliesValue(write))
    .map((write) => write.expression);
};

const iterationTargets = (
  statement: ESTree.ForInStatement | ESTree.ForOfStatement,
): readonly ESTree.Node[] =>
  statement.left.type === "VariableDeclaration"
    ? statement.left.declarations.map((declaration) => declaration.id)
    : [statement.left];

const recordIteration = (
  state: BindingIndexState,
  input: {
    readonly operator: "for-in" | "for-of";
    readonly sources: readonly CanonicalValueCallArgumentSource[];
    readonly statement: ESTree.ForInStatement | ESTree.ForOfStatement;
  },
): void => {
  iterationTargets(input.statement).forEach((target) => {
    input.sources.forEach((source) => {
      recordTarget(state, {
        expression: source.expression,
        iteration: input.statement,
        operator: input.operator,
        sourcePath: source.sourcePath,
        start: input.statement.start,
        target,
      });
    });
  });
};

type BindingInvocationRecorder = ReturnType<typeof createCanonicalValueBindingInvocationRecorder>;

const bindingResultQueries = (
  runtime: Omit<Parameters<typeof canonicalValueBindingCallReturns>[0], "invocation">,
): Pick<
  CanonicalValueBindingIndex,
  | "callReturnResults"
  | "callYieldResults"
  | "collectionCallbackReturnResults"
  | "collectionCallbackResults"
  | "iterableYieldResults"
> => ({
  callReturnResults: (invocation) => canonicalValueBindingCallReturns({ ...runtime, invocation }),
  callYieldResults: (invocation) => canonicalValueBindingCallYields({ ...runtime, invocation }),
  collectionCallbackReturnResults: (invocation) =>
    canonicalValueBindingCollectionCallbackReturns({ ...runtime, invocation }),
  collectionCallbackResults: (invocation) =>
    canonicalValueBindingCollectionCallbackResults({ ...runtime, invocation }),
  iterableYieldResults: (expression) =>
    canonicalValueBindingIterableYields({ ...runtime, expression }),
});

const recordAssignment = (
  state: BindingIndexState,
  input: {
    readonly assignment: ESTree.AssignmentExpression;
    readonly recorder: BindingInvocationRecorder;
  },
): void => {
  const { assignment, recorder } = input;
  recordTarget(state, {
    expression: assignment.right,
    operator: assignment.operator,
    sourcePath: [],
    start: assignment.start,
    target: assignment.left,
  });
  const target = canonicalValueUnwrapAssignmentTarget(assignment.left);
  if (target.type === "MemberExpression") recorder.recordAssignmentSetter(assignment, target);
  else if (target.type === "ArrayPattern") {
    recorder.recordIteratorAdvancement(assignment.right, assignment);
  }
};

const recordUpdateExpression = (
  state: BindingIndexState,
  input: { readonly node: ESTree.UpdateExpression; readonly recorder: BindingInvocationRecorder },
): void => {
  const { node, recorder } = input;
  recordTarget(state, {
    expression: node.argument,
    operator: "update",
    sourcePath: [],
    start: node.start,
    target: node.argument,
  });
  const target = canonicalValueUnwrapAssignmentTarget(node.argument);
  if (target.type === "MemberExpression") recorder.recordUpdateSetter(node, target);
};

const recordUnaryExpression = (state: BindingIndexState, node: ESTree.UnaryExpression): void => {
  if (node.operator !== "delete") return;
  recordTarget(state, {
    expression: node.argument,
    operator: "delete",
    sourcePath: [],
    start: node.start,
    target: node.argument,
  });
};

export const createCanonicalValueBindingIndex = (
  sourceCode: Pick<SourceCode, "getAncestors" | "getScope" | "scopeManager">,
): CanonicalValueBindingIndex => {
  const state: BindingIndexState = {
    bindingWrites: new Map(),
    callArguments: new Map(),
    executionIndex: createCanonicalValueExecutionIndex(sourceCode),
    memberWrites: new Map(),
    resolvedIdentifiers: new WeakMap(),
    sourceCode,
  };
  const returnIndex = createCanonicalValueBindingReturnIndex(state.executionIndex);
  const resultQueryRuntime = {
    bindingWritesOf: (binding: Variable) => state.bindingWrites.get(binding) ?? [],
    resolveIdentifier: (identifier: CanonicalValueIdentifier) =>
      resolveIdentifier(state, identifier),
    returnIndex,
  };
  const decorators = new Set<ESTree.Decorator>();
  const invocationRecorder = createCanonicalValueBindingInvocationRecorder({
    bindingWritesOf: (binding) => state.bindingWrites.get(binding) ?? [],
    executionIndex: state.executionIndex,
    functionReturnResults: returnIndex.functionReturnResults,
    recordCallArguments: (called, occurrence) => {
      if (!canonicalValueIsFunctionNode(called.node)) return;
      const existing = state.callArguments.get(called.node) ?? [];
      if (existing.some((entry) => entry.invocation === occurrence)) return;
      state.callArguments.set(called.node, [
        ...existing,
        { argumentSegments: called.argumentSegments, invocation: occurrence },
      ]);
    },
    recordParameter: (write) => {
      recordTarget(state, write);
    },
    recordMemberGetter: returnIndex.recordMemberGetter,
    resolveIdentifier: (identifier) => resolveIdentifier(state, identifier),
  });
  const globalWriteIndex = createCanonicalValueGlobalWriteIndex({
    executionIndex: state.executionIndex,
    resolveIdentifier: (identifier) => resolveIdentifier(state, identifier),
  });
  const callFinalizer = createCanonicalValueBindingCallFinalizer({
    bindingWriteCount: () =>
      [...state.bindingWrites.values()].reduce((total, writes) => total + writes.length, 0),
    recordCall: invocationRecorder.recordCallExpression,
  });
  const globalAwareRecorders = createCanonicalValueGlobalWriteRecorders({
    globalWriteIndex,
    recordAssignment: (node) => {
      recordAssignment(state, { assignment: node, recorder: invocationRecorder });
    },
    recordCall: callFinalizer.record,
    recordUnary: (node) => {
      recordUnaryExpression(state, node);
    },
    recordUpdate: (node) => {
      recordUpdateExpression(state, { node, recorder: invocationRecorder });
    },
  });
  return {
    allBindings: () => state.sourceCode.scopeManager.scopes.flatMap((scope) => scope.variables),
    ...bindingResultQueries(resultQueryRuntime),
    callArgumentOccurrencesOf: (identifier) => callArgumentOccurrencesOf(state, identifier),
    bindingWritesOf: (binding, query = {}) =>
      filterCanonicalValueWrites(state.bindingWrites.get(binding) ?? [], query),
    definitionsOf: (binding) => binding.defs,
    executionContextAt: state.executionIndex.contextAt,
    executionOccurrencesOf: (node, query) =>
      state.executionIndex.writeOccurrencesOf(
        {
          executionContext: state.executionIndex.contextAt(node),
          expression: node,
          guards: state.executionIndex.guardsAt(node),
          invocation: null,
          iteration: null,
          operator: "=",
          sourceContext: {
            cutoff: node.start,
            executionContext: state.executionIndex.contextAt(node),
          },
          sourcePath: [],
          start: node.start,
        },
        query,
      ),
    finalize: () => {
      callFinalizer.finalize();
      decorators.forEach(invocationRecorder.recordDecorator);
      callFinalizer.finalize();
    },
    guardsAt: state.executionIndex.guardsAt,
    globalWrites: globalWriteIndex.writes,
    memberWritesOf: (binding, query = {}) =>
      filterCanonicalValueWrites(state.memberWrites.get(binding) ?? [], query),
    memberReadResults: returnIndex.memberReadResults,
    recordAssignment: globalAwareRecorders.recordAssignment,
    recordAssignmentPattern: (pattern) => {
      if (!state.executionIndex.isParameterDefault(pattern)) return;
      recordTarget(state, {
        expression: pattern.right,
        operator: "parameter-default",
        sourcePath: [],
        start: pattern.start,
        target: pattern.left,
      });
    },
    recordCallExpression: globalAwareRecorders.recordCall,
    recordBinaryExpression: invocationRecorder.recordBinaryExpression,
    recordClassDeclaration: invocationRecorder.recordClass,
    recordClassExpression: invocationRecorder.recordClass,
    recordDecorator: (node) => {
      decorators.add(node);
    },
    recordExportDefaultDeclaration: (node) => {
      const declaration = node.declaration;
      if (declaration.type === "FunctionDeclaration" || declaration.type === "FunctionExpression") {
        invocationRecorder.recordExternalFunction(declaration, node);
      } else if (
        declaration.type !== "ClassDeclaration" &&
        declaration.type !== "TSInterfaceDeclaration"
      ) {
        invocationRecorder.recordExternalExpression(declaration, node);
      }
    },
    recordExportNamedDeclaration: (node) => {
      const declaration = node.declaration;
      if (declaration?.type === "FunctionDeclaration") {
        invocationRecorder.recordExternalFunction(declaration, node);
      }
      if (declaration?.type === "VariableDeclaration") {
        declaration.declarations.forEach((declarator) => {
          if (declarator.init !== null) {
            invocationRecorder.recordExternalExpression(declarator.init, node);
          }
        });
      }
      node.specifiers.forEach((specifier) => {
        invocationRecorder.recordExternalExpression(specifier.local, node);
      });
    },
    recordForInStatement: (statement) => {
      recordIteration(state, {
        sources: canonicalValueForInSources({
          resolveAlias: (identifier) => aliasSources(state, identifier),
          source: statement.right,
        }),
        operator: "for-in",
        statement,
      });
    },
    recordForOfStatement: (statement) => {
      invocationRecorder.recordGeneratorAdvancement(statement.right, statement);
      invocationRecorder.recordIteratorAdvancement(statement.right, statement);
      recordIteration(state, {
        sources: canonicalValueForOfSources({
          resolveAlias: (identifier) => aliasSources(state, identifier),
          source: statement.right,
        }),
        operator: "for-of",
        statement,
      });
    },
    recordMemberExpression: invocationRecorder.recordMemberExpression,
    recordNewExpression: invocationRecorder.recordNewExpression,
    recordReturnStatement: returnIndex.recordReturnStatement,
    recordSpreadElement: invocationRecorder.recordSpreadElement,
    recordTaggedTemplateExpression: invocationRecorder.recordTaggedTemplateExpression,
    recordTemplateLiteral: invocationRecorder.recordTemplateLiteral,
    recordUnaryExpression: globalAwareRecorders.recordUnary,
    recordUpdateExpression: globalAwareRecorders.recordUpdate,
    recordVariableDeclarator: (declarator) => {
      if (declarator.init === null) return;
      recordTarget(state, {
        expression: declarator.init,
        operator: "declaration",
        sourcePath: [],
        start: declarator.start,
        target: declarator.id,
      });
      if (declarator.id.type === "ArrayPattern") {
        invocationRecorder.recordIteratorAdvancement(declarator.init, declarator);
      }
      if (declarator.parent.type === "VariableDeclaration") {
        const kind = declarator.parent.kind;
        if (kind === "using" || kind === "await using") {
          invocationRecorder.recordUsingResource({
            asynchronous: kind === "await using",
            expression: declarator.init,
            occurrence: declarator,
          });
        }
      }
    },
    recordYieldExpression: returnIndex.recordYieldExpression,
    resolveIdentifier: (identifier) => resolveIdentifier(state, identifier),
    writeOccurrencesOf: state.executionIndex.writeOccurrencesOf,
  };
};
