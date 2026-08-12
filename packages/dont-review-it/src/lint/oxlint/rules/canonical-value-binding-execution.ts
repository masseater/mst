import { flatMap, uniqBy } from "es-toolkit";

import { canonicalValueGuardsBetween } from "./canonical-value-execution-guards.ts";
import { canonicalValueNodeIsSyntacticallyReachable } from "./canonical-value-execution-reachability.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";
import type {
  CanonicalValueExecutionContext,
  CanonicalValueExecutionNode,
  CanonicalValueExecutionOccurrence,
  CanonicalValueGuard,
  CanonicalValueOccurrenceQuery,
  CanonicalValueWriteBase,
  CanonicalValueWriteOccurrence,
} from "./canonical-value-binding-types.ts";

type ExecutionIndexState = {
  readonly contexts: WeakMap<CanonicalValueExecutionNode, CanonicalValueExecutionContext>;
  readonly invocations: Map<
    CanonicalValueExecutionContext,
    readonly {
      readonly callee: CanonicalValueExecutionContext;
      readonly caller: CanonicalValueExecutionContext;
      readonly node: CanonicalValueExecutionOccurrence;
      readonly start: number;
    }[]
  >;
  readonly invocationsByCall: WeakMap<
    CanonicalValueExecutionOccurrence,
    readonly {
      readonly callee: CanonicalValueExecutionContext;
      readonly caller: CanonicalValueExecutionContext;
    }[]
  >;
  readonly sourceCode: Pick<SourceCode, "getAncestors" | "getScope">;
};

export type CanonicalValueExecutionIndex = {
  readonly contextAt: (node: ESTree.Node) => CanonicalValueExecutionContext;
  readonly guardsAt: (node: ESTree.Node) => readonly CanonicalValueGuard[];
  readonly isReachable: (node: ESTree.Node) => boolean;
  readonly isParameterDefault: (node: ESTree.AssignmentPattern) => boolean;
  readonly invocationExecutes: (input: {
    readonly callee: CanonicalValueExecutionNode;
    readonly node: CanonicalValueExecutionOccurrence;
  }) => boolean;
  readonly recordCall: (input: {
    readonly callees: readonly CanonicalValueExecutionNode[];
    readonly node: CanonicalValueExecutionOccurrence;
  }) => void;
  readonly writeOccurrencesOf: (
    write: CanonicalValueWriteBase,
    query: CanonicalValueOccurrenceQuery,
  ) => readonly CanonicalValueWriteOccurrence[];
};

export const canonicalValueIsFunctionNode = (
  node: ESTree.Node,
): node is ESTree.ArrowFunctionExpression | ESTree.Function =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "TSDeclareFunction" ||
  node.type === "TSEmptyBodyFunctionExpression";

export const canonicalValueIsInvocableFunction = (
  node: ESTree.Node,
): node is ESTree.ArrowFunctionExpression | ESTree.Function =>
  node.type === "ArrowFunctionExpression" ||
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression";

const canonicalValueIsExecutionNode = (node: ESTree.Node): node is CanonicalValueExecutionNode =>
  node.type === "Program" ||
  node.type === "PropertyDefinition" ||
  node.type === "StaticBlock" ||
  canonicalValueIsFunctionNode(node);

const nodeContains = (input: {
  readonly ancestor: ESTree.Node;
  readonly descendant: ESTree.Node;
  readonly seen: ReadonlySet<string>;
}): boolean => {
  if (input.ancestor === input.descendant) return true;
  const key = `${input.descendant.type}:${input.descendant.start}:${input.descendant.end}`;
  return (
    input.descendant.parent !== null &&
    !input.seen.has(key) &&
    nodeContains({
      ...input,
      descendant: input.descendant.parent,
      seen: new Set([...input.seen, key]),
    })
  );
};

export const canonicalValueNodeContains = (
  ancestor: ESTree.Node,
  descendant: ESTree.Node,
): boolean => nodeContains({ ancestor, descendant, seen: new Set() });

const findExecutionNode = (input: {
  readonly node: ESTree.Node;
  readonly origin: ESTree.Node;
  readonly seen: ReadonlySet<string>;
}): CanonicalValueExecutionNode | null => {
  const key = `${input.node.type}:${input.node.start}:${input.node.end}`;
  if (input.seen.has(key)) return null;
  if (
    input.node.type === "PropertyDefinition" &&
    ((input.node.computed && canonicalValueNodeContains(input.node.key, input.origin)) ||
      input.node.decorators.some((decorator) =>
        canonicalValueNodeContains(decorator, input.origin),
      ))
  ) {
    return findExecutionNode({
      ...input,
      node: input.node.parent,
      seen: new Set([...input.seen, key]),
    });
  }
  if (canonicalValueIsExecutionNode(input.node)) return input.node;
  return findExecutionNode({
    ...input,
    node: input.node.parent,
    seen: new Set([...input.seen, key]),
  });
};

const executionNodeAt = (node: ESTree.Node): CanonicalValueExecutionNode | null =>
  findExecutionNode({ node, origin: node, seen: new Set() });

const contextAt = (
  state: ExecutionIndexState,
  node: ESTree.Node,
): CanonicalValueExecutionContext => {
  const scopedNode = state.sourceCode.getScope(node).block;
  const executionNode =
    executionNodeAt(node) ?? (canonicalValueIsExecutionNode(scopedNode) ? scopedNode : null);
  if (executionNode === null) throw new TypeError("Execution context is unavailable");
  const cached = state.contexts.get(executionNode);
  if (cached !== undefined) return cached;
  const context = { node: executionNode, scope: state.sourceCode.getScope(executionNode) };
  state.contexts.set(executionNode, context);
  return context;
};

const guardsAt = (
  state: ExecutionIndexState,
  node: ESTree.Node,
): readonly CanonicalValueGuard[] => {
  const context = contextAt(state, node);
  return canonicalValueGuardsBetween(node, context.node);
};

const invocationStarts = (
  state: ExecutionIndexState,
  input: {
    readonly callSites: readonly CanonicalValueExecutionOccurrence[];
    readonly context: CanonicalValueExecutionContext;
    readonly cutoff: number;
    readonly firstStart: number | null;
    readonly seen: ReadonlySet<string>;
    readonly target: CanonicalValueExecutionContext;
  },
): readonly {
  readonly callSites: readonly CanonicalValueExecutionOccurrence[];
  readonly start: number;
}[] => {
  const contextKey = `${input.context.node.type}:${input.context.node.start}:${input.context.node.end}`;
  const targetKey = `${input.target.node.type}:${input.target.node.start}:${input.target.node.end}`;
  if (contextKey === targetKey) {
    return input.firstStart === null
      ? []
      : [{ callSites: input.callSites, start: input.firstStart }];
  }
  if (input.seen.has(contextKey)) return [];
  const seen = new Set([...input.seen, contextKey]);
  const invocations = state.invocations.get(input.context) ?? [];
  return flatMap(
    invocations.filter(
      (invocation) => input.firstStart !== null || invocation.start < input.cutoff,
    ),
    (invocation) =>
      invocationStarts(state, {
        ...input,
        callSites: [...input.callSites, invocation.node],
        context: invocation.callee,
        firstStart: input.firstStart ?? invocation.start,
        seen,
      }),
  );
};

const calledOccurrences = (
  state: ExecutionIndexState,
  input: { readonly query: CanonicalValueOccurrenceQuery; readonly write: CanonicalValueWriteBase },
): readonly CanonicalValueWriteOccurrence[] =>
  uniqBy(
    invocationStarts(state, {
      callSites: [],
      context: input.query.executionContext,
      cutoff: input.query.cutoff,
      firstStart: null,
      seen: new Set(),
      target: input.write.executionContext,
    }),
    (path) => path.callSites.map((call) => call.start).join(":"),
  ).map((path) => ({ ...path, kind: "called-context" }));

const programNodeOf = (node: ESTree.Node): ESTree.Program => {
  if (node.type === "Program") return node;
  return programNodeOf(node.parent);
};

const callerExecutes = (
  state: ExecutionIndexState,
  caller: CanonicalValueExecutionContext,
): boolean => {
  if (caller.node.type === "Program") return true;
  const program = contextAt(state, programNodeOf(caller.node));
  return (
    invocationStarts(state, {
      callSites: [],
      context: program,
      cutoff: Number.POSITIVE_INFINITY,
      firstStart: null,
      seen: new Set(),
      target: caller,
    }).length !== 0
  );
};

const invocationExecutes = (
  state: ExecutionIndexState,
  input: {
    readonly callee: CanonicalValueExecutionNode;
    readonly node: CanonicalValueExecutionOccurrence;
  },
): boolean => {
  const context = contextAt(state, input.callee);
  return (state.invocationsByCall.get(input.node) ?? []).some(
    (entry) => entry.callee === context && callerExecutes(state, entry.caller),
  );
};

const parameterOccurrences = (
  state: ExecutionIndexState,
  input: { readonly query: CanonicalValueOccurrenceQuery; readonly write: CanonicalValueWriteBase },
): readonly CanonicalValueWriteOccurrence[] => {
  const invocation = input.write.invocation;
  if (invocation === null) return [];
  if (
    input.query.executionContext !== input.write.executionContext &&
    !canonicalValueNodeContains(
      input.write.executionContext.node,
      input.query.executionContext.node,
    )
  ) {
    return [];
  }
  const entries = state.invocationsByCall.get(invocation) ?? [];
  return uniqBy(
    flatMap(
      entries.filter((entry) => entry.callee === input.write.executionContext),
      (entry) => {
        if (entry.caller.node.type === "Program") {
          return [{ callSites: [invocation], start: input.write.start }];
        }
        const program = contextAt(state, programNodeOf(entry.caller.node));
        return invocationStarts(state, {
          callSites: [],
          context: program,
          cutoff: Number.POSITIVE_INFINITY,
          firstStart: null,
          seen: new Set(),
          target: entry.caller,
        }).map((path) => ({
          callSites: [...path.callSites, invocation],
          start: input.write.start,
        }));
      },
    ),
    (path) => path.callSites.map((call) => call.start).join(":"),
  ).map((path) => ({ ...path, kind: "called-context" }));
};

const parentOccurrences = (
  state: ExecutionIndexState,
  input: { readonly query: CanonicalValueOccurrenceQuery; readonly write: CanonicalValueWriteBase },
): readonly CanonicalValueWriteOccurrence[] => {
  const paths = invocationStarts(state, {
    callSites: [],
    context: input.write.executionContext,
    cutoff: input.query.cutoff,
    firstStart: null,
    seen: new Set(),
    target: input.query.executionContext,
  });
  if (paths.length === 0) {
    return [{ callSites: [], kind: "parent-context", start: input.write.start }];
  }
  return paths
    .filter((path) => input.write.start < (path.callSites[0]?.start ?? input.query.cutoff))
    .map((path) => ({
      callSites: path.callSites,
      kind: "parent-context",
      start: input.write.start,
    }));
};

const writeOccurrencesOf = (
  state: ExecutionIndexState,
  input: { readonly query: CanonicalValueOccurrenceQuery; readonly write: CanonicalValueWriteBase },
): readonly CanonicalValueWriteOccurrence[] => {
  if (!canonicalValueNodeIsSyntacticallyReachable(state.sourceCode, input.write.expression)) {
    return [];
  }
  if (input.write.invocation !== null) return parameterOccurrences(state, input);
  if (input.write.executionContext === input.query.executionContext) {
    return input.write.start < input.query.cutoff
      ? [{ callSites: [], kind: "same-context", start: input.write.start }]
      : [];
  }
  if (
    canonicalValueNodeContains(input.write.executionContext.node, input.query.executionContext.node)
  ) {
    return parentOccurrences(state, input);
  }
  return calledOccurrences(state, input);
};

const recordCall = (
  state: ExecutionIndexState,
  input: {
    readonly callees: readonly CanonicalValueExecutionNode[];
    readonly node: CanonicalValueExecutionOccurrence;
  },
): void => {
  if (!canonicalValueNodeIsSyntacticallyReachable(state.sourceCode, input.node)) return;
  const caller = contextAt(state, input.node);
  const invocations = state.invocations.get(caller) ?? [];
  const additions = uniqBy(input.callees, (callee) => callee)
    .map((callee) => ({
      callee: contextAt(state, callee),
      caller,
      node: input.node,
      start: input.node.start,
    }))
    .filter(
      (addition) =>
        !invocations.some(
          (invocation) =>
            invocation.callee === addition.callee && invocation.node === addition.node,
        ),
    );
  state.invocations.set(caller, [...invocations, ...additions]);
  const existingByCall = state.invocationsByCall.get(input.node) ?? [];
  state.invocationsByCall.set(
    input.node,
    uniqBy(
      [
        ...existingByCall,
        ...additions.map((addition) => ({ callee: addition.callee, caller: addition.caller })),
      ],
      (entry) => entry.callee,
    ),
  );
};

export const createCanonicalValueExecutionIndex = (
  sourceCode: Pick<SourceCode, "getAncestors" | "getScope">,
): CanonicalValueExecutionIndex => {
  const state: ExecutionIndexState = {
    contexts: new WeakMap(),
    invocations: new Map(),
    invocationsByCall: new WeakMap(),
    sourceCode,
  };
  return {
    contextAt: (node) => contextAt(state, node),
    guardsAt: (node) => guardsAt(state, node),
    isReachable: (node) => canonicalValueNodeIsSyntacticallyReachable(state.sourceCode, node),
    isParameterDefault: (node) => {
      const owner = executionNodeAt(node);
      return (
        owner !== null &&
        canonicalValueIsFunctionNode(owner) &&
        owner.params.some((parameter) => canonicalValueNodeContains(parameter, node))
      );
    },
    invocationExecutes: (input) => invocationExecutes(state, input),
    recordCall: (input) => {
      recordCall(state, input);
    },
    writeOccurrencesOf: (write, query) => writeOccurrencesOf(state, { query, write }),
  };
};

export const canonicalValueOccurrenceOrder = (
  occurrence: CanonicalValueWriteOccurrence,
  node: ESTree.Node,
): readonly number[] => [...occurrence.callSites.map((callSite) => callSite.start), node.start];
