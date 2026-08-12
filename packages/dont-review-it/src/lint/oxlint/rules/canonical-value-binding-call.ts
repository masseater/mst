import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueArrayCallbackFunctions as arrayCallbackFunctions } from "./canonical-value-binding-array-callback.ts";
import {
  canonicalValueAsyncCallbackFunctions as asyncCallbackFunctions,
  canonicalValuePromiseConstructorFunctions as promiseConstructorFunctions,
} from "./canonical-value-binding-async-callback.ts";
import {
  canonicalValueAppendCallArgumentSegments,
  canonicalValueDirectCallArgumentSegments,
} from "./canonical-value-binding-call-segments.ts";
import {
  canonicalValueIsInvocableFunction,
  canonicalValueIsFunctionNode,
} from "./canonical-value-binding-execution.ts";
import { canonicalValueExternalCallbackFunctions as externalCallbackFunctions } from "./canonical-value-binding-external-callback.ts";
import {
  canonicalValueConstructedCandidates as constructedClassCandidates,
  canonicalValueDerivedSuperCandidates,
  canonicalValueMemberAccessorCandidates,
  canonicalValueMemberCallableCandidates,
  canonicalValueStaticMemberName,
  canonicalValueWellKnownSymbolCallableCandidates,
} from "./canonical-value-binding-member-call.ts";
import { canonicalValueScheduledCallbackFunctions as scheduledCallbackFunctions } from "./canonical-value-binding-scheduled-callback.ts";
import { canonicalValueEffectiveCalls } from "./canonical-value-binding-standard-call.ts";
import { canonicalValueStandardCallbackFunctions as standardCallbackFunctions } from "./canonical-value-binding-standard-callback.ts";
import {
  canonicalValueWriteSuppliesValue,
  type CanonicalValueCallArgumentSegment,
  type CanonicalValueExecutionOccurrence,
  type CanonicalValueFunctionExpression,
} from "./canonical-value-binding-types.ts";

import type { ESTree, Variable } from "@oxlint/plugins";
import type {
  CanonicalValueBindingCallInput,
  CanonicalValueCallableCandidate,
  CanonicalValueCallableRuntime,
  CanonicalValueCalledFunction,
  CanonicalValueIdentifierSource,
} from "./canonical-value-binding-call-types.ts";
export type { CanonicalValueCalledFunction } from "./canonical-value-binding-call-types.ts";
export { canonicalValueStaticClassExecutions } from "./canonical-value-binding-member-call.ts";

const definitionSources = (
  runtime: CanonicalValueCallableRuntime,
  binding: Variable,
): readonly ESTree.Expression[] =>
  binding.defs.flatMap((definition) => {
    const node = definition.node;
    if (node.type === "FunctionDeclaration") return [node];
    if (node.start >= runtime.cutoff) return [];
    if (node.type === "ClassDeclaration") return [node];
    if (node.type === "VariableDeclarator" && node.init !== null) return [node.init];
    return [];
  });

const bindingSources = (
  runtime: CanonicalValueCallableRuntime,
  binding: Variable,
): readonly ESTree.Expression[] => [
  ...definitionSources(runtime, binding),
  ...runtime
    .bindingWritesOf(binding)
    .filter(
      (write) =>
        write.start < runtime.cutoff &&
        write.sourcePath.length === 0 &&
        canonicalValueWriteSuppliesValue(write),
    )
    .map((write) => write.expression),
];

const identifierSources = (
  runtime: CanonicalValueCallableRuntime,
  identifier: ESTree.IdentifierReference,
): readonly CanonicalValueIdentifierSource[] => {
  const binding = runtime.resolveIdentifier(identifier);
  if (binding === null || runtime.seen.has(binding)) return [];
  const next = { ...runtime, seen: new Set([...runtime.seen, binding]) };
  return bindingSources(next, binding).map((source) => ({ runtime: next, source }));
};

const memberRuntime = (runtime: CanonicalValueCallableRuntime) => ({
  ...runtime,
  callable: callableCandidates,
  identifierSources,
});

const boundCallable = (
  runtime: CanonicalValueCallableRuntime,
  call: ESTree.CallExpression,
): readonly CanonicalValueCallableCandidate[] => {
  const callee = unwrapExpression(call.callee);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return [];
  if (canonicalValueStaticMemberName(callee) !== "bind") return [];
  return callableCandidates(runtime, callee.object).map((candidate) => ({
    ...candidate,
    argumentSegments: canonicalValueAppendCallArgumentSegments(
      candidate.argumentSegments,
      canonicalValueDirectCallArgumentSegments(call.arguments.slice(1)),
    ),
  }));
};

const identifierCallables = (
  runtime: CanonicalValueCallableRuntime,
  identifier: ESTree.IdentifierReference,
): readonly CanonicalValueCallableCandidate[] =>
  identifierSources(runtime, identifier).flatMap(({ runtime: next, source }) =>
    canonicalValueIsInvocableFunction(source)
      ? [{ argumentSegments: [], node: source }]
      : callableCandidates(next, source),
  );

const callableCandidates = (
  runtime: CanonicalValueCallableRuntime,
  expression: ESTree.Expression,
): readonly CanonicalValueCallableCandidate[] => {
  const unwrapped = unwrapExpression(expression);
  if (runtime.seenExpressions?.has(unwrapped) === true) return [];
  const next = {
    ...runtime,
    seenExpressions: new Set([...(runtime.seenExpressions ?? []), unwrapped]),
  };
  if (canonicalValueIsInvocableFunction(unwrapped)) {
    return [{ argumentSegments: [], node: unwrapped }];
  }
  if (unwrapped.type === "Identifier") return identifierCallables(next, unwrapped);
  if (unwrapped.type === "CallExpression") return boundCallable(next, unwrapped);
  return unwrapped.type === "MemberExpression"
    ? canonicalValueMemberCallableCandidates(memberRuntime(next), unwrapped)
    : [];
};

const taggedCandidates = (
  runtime: CanonicalValueCallableRuntime,
  source: ESTree.TaggedTemplateExpression,
): readonly CanonicalValueCallableCandidate[] =>
  callableCandidates(runtime, source.tag).map((candidate) => ({
    ...candidate,
    argumentSegments: canonicalValueAppendCallArgumentSegments(candidate.argumentSegments, [
      { kind: "unknown", width: 1 },
      ...canonicalValueDirectCallArgumentSegments(source.quasi.expressions),
    ]),
  }));

const newCandidates = (
  runtime: CanonicalValueCallableRuntime,
  source: ESTree.NewExpression,
): readonly CanonicalValueCallableCandidate[] => {
  const argumentSegments = canonicalValueDirectCallArgumentSegments(source.arguments);
  const classes = constructedClassCandidates(memberRuntime(runtime), {
    argumentSegments,
    callee: source.callee,
  });
  if (classes.length !== 0) return classes;
  return callableCandidates(runtime, source.callee).map((candidate) => ({
    ...candidate,
    argumentSegments: canonicalValueAppendCallArgumentSegments(
      candidate.argumentSegments,
      argumentSegments,
    ),
  }));
};

const callCandidates = (
  runtime: CanonicalValueCallableRuntime,
  source: ESTree.CallExpression,
): readonly CanonicalValueCallableCandidate[] =>
  canonicalValueEffectiveCalls({ ...runtime, identifierSources }, source).flatMap((effective) =>
    callableCandidates(runtime, effective.target).map((candidate) => ({
      ...candidate,
      argumentSegments: canonicalValueAppendCallArgumentSegments(
        candidate.argumentSegments,
        effective.argumentSegments,
      ),
    })),
  );

export const canonicalValueCalledFunctions = (
  input: CanonicalValueBindingCallInput,
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.invocation.start, seen: new Set<Variable>() };
  const source = input.invocation;
  const candidates =
    source.type === "NewExpression"
      ? newCandidates(runtime, source)
      : source.type === "TaggedTemplateExpression"
        ? taggedCandidates(runtime, source)
        : callCandidates(runtime, source);
  return uniqBy(candidates, (candidate) => candidate.node).map((candidate) => ({
    ...candidate,
    source,
  }));
};

export const canonicalValueImplicitlyCalledFunctions = (
  input: Omit<CanonicalValueBindingCallInput, "invocation"> & {
    readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
    readonly expression: ESTree.Expression;
    readonly occurrence: CanonicalValueExecutionOccurrence;
  },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.occurrence.start, seen: new Set<Variable>() };
  return uniqBy(callableCandidates(runtime, input.expression), (candidate) => candidate.node).map(
    (candidate) => ({
      ...candidate,
      argumentSegments: canonicalValueAppendCallArgumentSegments(
        candidate.argumentSegments,
        input.argumentSegments,
      ),
      source: input.expression,
    }),
  );
};

export const canonicalValueWellKnownSymbolFunctions = (
  input: Omit<CanonicalValueBindingCallInput, "invocation"> & {
    readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
    readonly expression: ESTree.Expression;
    readonly name: string;
    readonly occurrence: CanonicalValueExecutionOccurrence;
  },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.occurrence.start, seen: new Set<Variable>() };
  return canonicalValueWellKnownSymbolCallableCandidates(memberRuntime(runtime), input).map(
    (candidate) => ({
      ...candidate,
      argumentSegments: canonicalValueAppendCallArgumentSegments(
        candidate.argumentSegments,
        input.argumentSegments,
      ),
      source: input.expression,
    }),
  );
};

export const canonicalValueArrayCallbackFunctions = (
  input: CanonicalValueBindingCallInput & {
    readonly functionReturnResults: (
      node: ESTree.ArrowFunctionExpression | ESTree.Function,
    ) => readonly ESTree.Expression[];
    readonly invocation: ESTree.CallExpression;
  },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.invocation.start, seen: new Set<Variable>() };
  return arrayCallbackFunctions({
    call: input.invocation,
    callable: callableCandidates,
    functionReturnResults: input.functionReturnResults,
    identifierSources,
    runtime,
  });
};

export const canonicalValueAsyncCallbackFunctions = (
  input: CanonicalValueBindingCallInput & {
    readonly functionReturnResults: (
      node: ESTree.ArrowFunctionExpression | ESTree.Function,
    ) => readonly ESTree.Expression[];
    readonly invocation: ESTree.CallExpression;
  },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.invocation.start, seen: new Set<Variable>() };
  return asyncCallbackFunctions({
    call: input.invocation,
    callable: callableCandidates,
    functionReturnResults: input.functionReturnResults,
    identifierSources,
    runtime,
  });
};

export const canonicalValueScheduledCallbackFunctions = (
  input: CanonicalValueBindingCallInput & {
    readonly functionReturnResults: (
      node: ESTree.ArrowFunctionExpression | ESTree.Function,
    ) => readonly ESTree.Expression[];
    readonly invocation: ESTree.CallExpression;
  },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.invocation.start, seen: new Set<Variable>() };
  return scheduledCallbackFunctions({
    call: input.invocation,
    callable: callableCandidates,
    functionReturnResults: input.functionReturnResults,
    identifierSources,
    runtime,
  });
};

export const canonicalValueStandardCallbackFunctions = (
  input: CanonicalValueBindingCallInput & {
    readonly functionReturnResults: (
      node: ESTree.ArrowFunctionExpression | ESTree.Function,
    ) => readonly ESTree.Expression[];
    readonly invocation: ESTree.CallExpression;
  },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.invocation.start, seen: new Set<Variable>() };
  return standardCallbackFunctions({
    call: input.invocation,
    callable: callableCandidates,
    functionReturnResults: input.functionReturnResults,
    identifierSources,
    runtime,
  });
};

export const canonicalValueExternalCallbackFunctions = (
  input: CanonicalValueBindingCallInput & { readonly invocation: ESTree.CallExpression },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.invocation.start, seen: new Set<Variable>() };
  return externalCallbackFunctions({
    call: input.invocation,
    callable: callableCandidates,
    identifierSources,
    runtime,
  });
};

export const canonicalValuePromiseConstructorFunctions = (
  input: CanonicalValueBindingCallInput & {
    readonly functionReturnResults: (
      node: ESTree.ArrowFunctionExpression | ESTree.Function,
    ) => readonly ESTree.Expression[];
    readonly invocation: ESTree.NewExpression;
  },
): readonly CanonicalValueCalledFunction[] => {
  const runtime = { ...input, cutoff: input.invocation.start, seen: new Set<Variable>() };
  return promiseConstructorFunctions({
    callable: callableCandidates,
    expression: input.invocation,
    functionReturnResults: input.functionReturnResults,
    identifierSources,
    runtime,
  });
};

const generatorCalls = (
  runtime: CanonicalValueCallableRuntime,
  expression: ESTree.Expression,
): readonly CanonicalValueCalledFunction[] => {
  const unwrapped = unwrapExpression(expression);
  if (
    unwrapped.type === "CallExpression" ||
    unwrapped.type === "NewExpression" ||
    unwrapped.type === "TaggedTemplateExpression"
  ) {
    return canonicalValueCalledFunctions({ ...runtime, invocation: unwrapped }).filter(
      (called) => canonicalValueIsFunctionNode(called.node) && called.node.generator,
    );
  }
  if (unwrapped.type === "Identifier") {
    return identifierSources(runtime, unwrapped).flatMap(({ runtime: next, source }) =>
      generatorCalls(next, source),
    );
  }
  if (unwrapped.type === "ConditionalExpression") {
    return [
      ...generatorCalls(runtime, unwrapped.consequent),
      ...generatorCalls(runtime, unwrapped.alternate),
    ];
  }
  const last = unwrapped.type === "SequenceExpression" ? unwrapped.expressions.at(-1) : undefined;
  return last === undefined ? [] : generatorCalls(runtime, last);
};

export const canonicalValueAdvancedGeneratorFunctions = (
  input: Omit<CanonicalValueBindingCallInput, "invocation"> & {
    readonly expression: ESTree.Expression;
    readonly occurrence: CanonicalValueExecutionOccurrence;
  },
): readonly CanonicalValueCalledFunction[] =>
  uniqBy(
    generatorCalls(
      { ...input, cutoff: input.occurrence.start, seen: new Set<Variable>() },
      input.expression,
    ),
    (called) => called.node,
  );

export const canonicalValueMemberAccessors = (
  input: Omit<CanonicalValueBindingCallInput, "invocation"> & {
    readonly kind: "get" | "set";
    readonly member: ESTree.MemberExpression;
  },
): readonly CanonicalValueFunctionExpression[] =>
  canonicalValueMemberAccessorCandidates({
    kind: input.kind,
    member: input.member,
    runtime: memberRuntime({ ...input, cutoff: input.member.start, seen: new Set<Variable>() }),
  });

export const canonicalValueDerivedSuperFunctions = (
  input: Omit<CanonicalValueBindingCallInput, "invocation"> & {
    readonly call: ESTree.CallExpression;
  },
): readonly CanonicalValueCalledFunction[] =>
  canonicalValueDerivedSuperCandidates(
    memberRuntime({ ...input, cutoff: input.call.start, seen: new Set<Variable>() }),
    {
      argumentSegments: canonicalValueDirectCallArgumentSegments(input.call.arguments),
      call: input.call,
    },
  ).map((candidate) => ({ ...candidate, source: input.call }));
