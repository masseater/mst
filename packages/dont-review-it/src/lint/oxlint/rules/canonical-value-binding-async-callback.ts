import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueEffectiveCallArgumentExpressions } from "./canonical-value-binding-standard-arguments.ts";
import {
  canonicalValueEffectiveCalls,
  type CanonicalValueEffectiveCall,
} from "./canonical-value-binding-standard-call.ts";
import { canonicalValueCallbackStandardCallRuntime } from "./canonical-value-binding-standard-runtime.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import {
  canonicalValuePromiseExecutorCandidates,
  canonicalValuePromiseExecutorFlow,
  canonicalValueUnknownPromiseArgumentSet,
} from "./canonical-value-promise-executor.ts";
import { canonicalValueIsGlobalPromise } from "./canonical-value-promise-global.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueCallableRuntime,
  CanonicalValueCalledFunction,
  CanonicalValueResultCallbackRuntime,
} from "./canonical-value-binding-call-types.ts";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";

type AsyncCallbackRuntime = CanonicalValueResultCallbackRuntime;

type PromiseChannel = readonly (readonly CanonicalValueCallArgumentSegment[])[];

type PromiseFlow = {
  readonly fulfilled: PromiseChannel;
  readonly rejected: PromiseChannel;
};

type PromiseCallback = {
  readonly argumentSets: PromiseChannel;
  readonly callback: ESTree.Expression;
};

type PromiseFlowRuntime = AsyncCallbackRuntime & {
  readonly seen: ReadonlySet<ESTree.Expression>;
};

const sourceArgumentSet = (
  expression: ESTree.Expression,
): readonly CanonicalValueCallArgumentSegment[] => [{ expression, kind: "source", sourcePath: [] }];

const unknownChannel = (): PromiseChannel => [canonicalValueUnknownPromiseArgumentSet()];

const emptyFlow = (): PromiseFlow => ({ fulfilled: [], rejected: [] });

const unknownFlow = (): PromiseFlow => ({
  fulfilled: unknownChannel(),
  rejected: unknownChannel(),
});

const appendFlow = (left: PromiseFlow, right: PromiseFlow): PromiseFlow => ({
  fulfilled: [...left.fulfilled, ...right.fulfilled],
  rejected: [...left.rejected, ...right.rejected],
});

const directPromiseFlow = (
  input: AsyncCallbackRuntime,
  invocation: CanonicalValueEffectiveCall,
): PromiseFlow | null => {
  const callee = unwrapExpression(invocation.target);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return null;
  if (!canonicalValueIsGlobalPromise(input.runtime, callee.object)) return null;
  const name = canonicalValueStaticMemberName(callee);
  if (name !== "all" && name !== "resolve" && name !== "reject") return null;
  const argument = canonicalValueEffectiveCallArgumentExpressions(
    canonicalValueCallbackStandardCallRuntime(input),
    {
      index: 0,
      invocation,
    },
  )[0];
  const channel = [
    argument === undefined
      ? canonicalValueUnknownPromiseArgumentSet()
      : sourceArgumentSet(argument),
  ];
  if (name === "all") return { fulfilled: channel, rejected: unknownChannel() };
  return name === "resolve"
    ? { fulfilled: channel, rejected: [] }
    : { fulfilled: [], rejected: channel };
};

const callbackExpression = (
  input: AsyncCallbackRuntime & {
    readonly index: number;
    readonly invocation: CanonicalValueEffectiveCall;
  },
): ESTree.Expression | null =>
  canonicalValueEffectiveCallArgumentExpressions(canonicalValueCallbackStandardCallRuntime(input), {
    index: input.index,
    invocation: input.invocation,
  })[0] ?? null;

const flowFromReturnExpression = (
  input: PromiseFlowRuntime,
  expression: ESTree.Expression,
): PromiseFlow =>
  promiseFlow(input, expression) ?? {
    fulfilled: [sourceArgumentSet(expression)],
    rejected: unknownChannel(),
  };

const callbackResultFlow = (
  input: PromiseFlowRuntime,
  callback: ESTree.Expression,
): PromiseFlow => {
  const candidates = input.callable(input.runtime, callback);
  if (candidates.length === 0) return unknownFlow();
  const returns = candidates.flatMap((candidate) => {
    const node = candidate.node;
    return node.type === "ArrowFunctionExpression" ||
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression"
      ? input.functionReturnResults(node)
      : [];
  });
  if (returns.length === 0) return unknownFlow();
  return returns
    .map((expression) => flowFromReturnExpression(input, expression))
    .reduce(appendFlow, emptyFlow());
};

const handledFlow = (input: PromiseFlowRuntime, callback: ESTree.Expression | null): PromiseFlow =>
  callback === null ? emptyFlow() : callbackResultFlow(input, callback);

const thenFlow = (
  input: PromiseFlowRuntime,
  flow: { readonly invocation: CanonicalValueEffectiveCall; readonly previous: PromiseFlow },
): PromiseFlow => {
  const { invocation, previous } = flow;
  const fulfilledCallback = callbackExpression({ ...input, index: 0, invocation });
  const rejectedCallback = callbackExpression({ ...input, index: 1, invocation });
  const fulfilled =
    previous.fulfilled.length === 0
      ? emptyFlow()
      : fulfilledCallback === null
        ? { fulfilled: previous.fulfilled, rejected: [] }
        : handledFlow(input, fulfilledCallback);
  const rejected =
    previous.rejected.length === 0
      ? emptyFlow()
      : rejectedCallback === null
        ? { fulfilled: [], rejected: previous.rejected }
        : handledFlow(input, rejectedCallback);
  return appendFlow(fulfilled, rejected);
};

const catchFlow = (
  input: PromiseFlowRuntime,
  flow: { readonly invocation: CanonicalValueEffectiveCall; readonly previous: PromiseFlow },
): PromiseFlow => {
  const { invocation, previous } = flow;
  const callback = callbackExpression({ ...input, index: 0, invocation });
  const rejected =
    previous.rejected.length === 0
      ? emptyFlow()
      : callback === null
        ? { fulfilled: [], rejected: previous.rejected }
        : handledFlow(input, callback);
  return appendFlow({ fulfilled: previous.fulfilled, rejected: [] }, rejected);
};

const chainedPromiseFlow = (
  input: PromiseFlowRuntime,
  call: ESTree.CallExpression,
): PromiseFlow | null => {
  const flows = canonicalValueEffectiveCalls(
    canonicalValueCallbackStandardCallRuntime(input),
    call,
  ).flatMap((invocation) => {
    const callee = unwrapExpression(invocation.target);
    if (callee.type !== "MemberExpression" || callee.object.type === "Super") return [];
    const name = canonicalValueStaticMemberName(callee);
    if (name !== "then" && name !== "catch" && name !== "finally") return [];
    const receiver = invocation.thisArgument ?? callee.object;
    const previous = promiseFlow(input, receiver);
    if (previous === null) return [];
    if (name === "then") return [thenFlow(input, { invocation, previous })];
    if (name === "catch") return [catchFlow(input, { invocation, previous })];
    return [previous];
  });
  return flows.length === 0 ? null : flows.reduce(appendFlow, emptyFlow());
};

const identifierPromiseFlow = (
  input: PromiseFlowRuntime,
  identifier: ESTree.IdentifierReference,
): PromiseFlow | null => {
  const flows = input
    .identifierSources(input.runtime, identifier)
    .flatMap(({ runtime, source }) => {
      const flow = promiseFlow({ ...input, runtime }, source);
      return flow === null ? [] : [flow];
    });
  return flows.length === 0 ? null : flows.reduce(appendFlow, emptyFlow());
};

const nonCallPromiseFlow = (
  input: PromiseFlowRuntime,
  expression: Exclude<ESTree.Expression, ESTree.CallExpression>,
): PromiseFlow | null => {
  if (expression.type === "ImportExpression") {
    return { fulfilled: [sourceArgumentSet(expression)], rejected: [] };
  }
  if (expression.type === "Identifier") return identifierPromiseFlow(input, expression);
  if (expression.type === "NewExpression") {
    return canonicalValuePromiseExecutorFlow({ ...input, expression });
  }
  return null;
};

const promiseFlow = (
  input: PromiseFlowRuntime,
  rawExpression: ESTree.Expression,
): PromiseFlow | null => {
  const expression = unwrapExpression(rawExpression);
  if (input.seen.has(expression)) return unknownFlow();
  const next = { ...input, seen: new Set([...input.seen, expression]) };
  if (expression.type !== "CallExpression") return nonCallPromiseFlow(next, expression);
  const direct = canonicalValueEffectiveCalls(
    canonicalValueCallbackStandardCallRuntime(input),
    expression,
  ).flatMap((invocation) => {
    const flow = directPromiseFlow(input, invocation);
    return flow === null ? [] : [flow];
  });
  if (direct.length !== 0) return direct.reduce(appendFlow, emptyFlow());
  return chainedPromiseFlow(next, expression);
};

const presentCallback = (
  argumentSets: PromiseChannel,
  callback: ESTree.Expression | null,
): readonly PromiseCallback[] => (callback === null ? [] : [{ argumentSets, callback }]);

const callbacksForPromiseMethod = (input: {
  readonly invocation: CanonicalValueEffectiveCall;
  readonly runtime: AsyncCallbackRuntime;
  readonly flow: PromiseFlow;
  readonly name: string | null;
}): readonly PromiseCallback[] => {
  if (input.name === "then") {
    return [
      ...presentCallback(
        input.flow.fulfilled,
        callbackExpression({ ...input.runtime, index: 0, invocation: input.invocation }),
      ),
      ...presentCallback(
        input.flow.rejected,
        callbackExpression({ ...input.runtime, index: 1, invocation: input.invocation }),
      ),
    ];
  }
  if (input.name === "catch") {
    return presentCallback(
      input.flow.rejected,
      callbackExpression({ ...input.runtime, index: 0, invocation: input.invocation }),
    );
  }
  if (input.name !== "finally") return [];
  const possible = input.flow.fulfilled.length !== 0 || input.flow.rejected.length !== 0;
  return possible
    ? presentCallback(
        [[]],
        callbackExpression({ ...input.runtime, index: 0, invocation: input.invocation }),
      )
    : [];
};

const promiseCallbacks = (
  input: AsyncCallbackRuntime & { readonly call: ESTree.CallExpression },
): readonly PromiseCallback[] =>
  canonicalValueEffectiveCalls(
    canonicalValueCallbackStandardCallRuntime(input),
    input.call,
  ).flatMap((invocation) => {
    const callee = unwrapExpression(invocation.target);
    if (callee.type !== "MemberExpression" || callee.object.type === "Super") return [];
    const name = canonicalValueStaticMemberName(callee);
    if (name !== "then" && name !== "catch" && name !== "finally") return [];
    const receiver = invocation.thisArgument ?? callee.object;
    const flow = promiseFlow({ ...input, seen: new Set() }, receiver);
    if (flow === null) return [];
    return callbacksForPromiseMethod({ flow, invocation, name, runtime: input });
  });

const isQueueMicrotask = (
  runtime: CanonicalValueCallableRuntime,
  expression: ESTree.Expression,
): boolean => {
  const current = unwrapExpression(expression);
  if (canonicalValueIsGlobalIdentifier(runtime, { expression: current, name: "queueMicrotask" })) {
    return true;
  }
  if (current.type !== "MemberExpression" || current.object.type === "Super") return false;
  return (
    canonicalValueStaticMemberName(current) === "queueMicrotask" &&
    canonicalValueIsGlobalIdentifier(runtime, {
      expression: current.object,
      name: "globalThis",
    })
  );
};

const microtaskCallbacks = (
  input: AsyncCallbackRuntime & { readonly call: ESTree.CallExpression },
): readonly PromiseCallback[] => {
  return canonicalValueEffectiveCalls(
    canonicalValueCallbackStandardCallRuntime(input),
    input.call,
  ).flatMap((invocation) => {
    if (!isQueueMicrotask(input.runtime, invocation.target)) return [];
    const callback = callbackExpression({ ...input, index: 0, invocation });
    return callback === null ? [] : [{ argumentSets: [[]], callback }];
  });
};

const segmentKey = (segment: CanonicalValueCallArgumentSegment): string => {
  if (segment.kind === "unknown") return `unknown:${String(segment.width)}`;
  if (segment.kind === "direct") return segment.elements.map((element) => element.start).join(",");
  return `${segment.kind}:${segment.expression.start}`;
};

const candidateKey = (candidate: CanonicalValueCallableCandidate): string =>
  `${String(candidate.node.start)}:${candidate.argumentSegments.map(segmentKey).join("|")}`;

const candidatesForCallback = (
  input: AsyncCallbackRuntime,
  callback: PromiseCallback,
): readonly CanonicalValueCallableCandidate[] => {
  const callables = input.callable(input.runtime, callback.callback);
  return callback.argumentSets.flatMap((arguments_) =>
    callables.map((candidate) => ({
      ...candidate,
      argumentSegments: [...candidate.argumentSegments, ...arguments_],
    })),
  );
};

const calledCallbacks = (
  input: AsyncCallbackRuntime & { readonly call: ESTree.CallExpression },
  callbacks: readonly PromiseCallback[],
): readonly CanonicalValueCalledFunction[] =>
  uniqBy(
    callbacks.flatMap((callback) => candidatesForCallback(input, callback)),
    candidateKey,
  ).map((candidate) => ({ ...candidate, source: input.call }));

export const canonicalValueAsyncCallbackFunctions = (
  input: AsyncCallbackRuntime & { readonly call: ESTree.CallExpression },
): readonly CanonicalValueCalledFunction[] =>
  calledCallbacks(input, [...promiseCallbacks(input), ...microtaskCallbacks(input)]);

export const canonicalValuePromiseConstructorFunctions = (
  input: AsyncCallbackRuntime & { readonly expression: ESTree.NewExpression },
): readonly CanonicalValueCalledFunction[] =>
  canonicalValuePromiseExecutorCandidates(input).map((candidate) => ({
    ...candidate,
    argumentSegments: [...candidate.argumentSegments, { kind: "unknown" as const, width: 2 }],
    source: input.expression,
  }));
