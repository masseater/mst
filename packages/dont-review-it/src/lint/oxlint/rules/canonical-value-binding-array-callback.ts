import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueCallbackElementSegment,
  canonicalValueUnknownCallbackArguments,
  type CanonicalValueCallbackArguments,
  type CanonicalValueCallbackRuntime,
} from "./canonical-value-binding-callback-argument-set.ts";
import { canonicalValueCallbackArguments } from "./canonical-value-binding-callback-arguments.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueEffectiveCallArgumentExpressions } from "./canonical-value-binding-standard-arguments.ts";
import {
  canonicalValueEffectiveCalls,
  type CanonicalValueEffectiveCall,
} from "./canonical-value-binding-standard-call.ts";
import { canonicalValueCallbackStandardCallRuntime } from "./canonical-value-binding-standard-runtime.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueCalledFunction,
} from "./canonical-value-binding-call-types.ts";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";

const ARRAY_CALLBACK_METHODS = [
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flatMap",
  "forEach",
  "map",
  "reduce",
  "reduceRight",
  "some",
  "sort",
  "toSorted",
] as const;

const callbackCandidates = (
  input: CanonicalValueCallbackRuntime & {
    readonly argumentSets: readonly (readonly CanonicalValueCallArgumentSegment[])[];
    readonly callback: ESTree.Expression;
  },
): readonly CanonicalValueCallableCandidate[] =>
  input.argumentSets.flatMap((arguments_) =>
    input.callable(input.runtime, input.callback).map((candidate) => ({
      ...candidate,
      argumentSegments: [...candidate.argumentSegments, ...arguments_],
    })),
  );

const callbackSegmentKey = (segment: CanonicalValueCallArgumentSegment): string => {
  if (segment.kind === "direct") {
    return segment.elements.map((element) => `${element.start}:${element.end}`).join(",");
  }
  if (segment.kind === "unknown") return `unknown:${String(segment.width)}`;
  const projection =
    segment.kind === "source" ? segment.sourcePath.map((source) => source.kind).join("/") : "";
  return `${segment.kind}:${segment.expression.start}:${segment.expression.end}:${projection}`;
};

const callbackCandidateKey = (candidate: CanonicalValueCallableCandidate): string =>
  `${String(candidate.node.start)}:${candidate.argumentSegments.map(callbackSegmentKey).join("|")}`;

const reduceArgumentSets = (
  input: CanonicalValueCallbackRuntime & {
    readonly arguments: CanonicalValueCallbackArguments;
    readonly callback: ESTree.Expression;
    readonly fromRight: boolean;
    readonly invocation: CanonicalValueEffectiveCall;
  },
): readonly (readonly CanonicalValueCallArgumentSegment[])[] => {
  const ordered = input.fromRight
    ? input.arguments.arguments.toReversed()
    : input.arguments.arguments;
  const initial = canonicalValueEffectiveCallArgumentExpressions(
    canonicalValueCallbackStandardCallRuntime(input),
    {
      index: 1,
      invocation: input.invocation,
    },
  )[0];
  const [first, ...remaining] = ordered;
  const elements = initial === undefined ? remaining : ordered;
  if (first === undefined || elements.length === 0) return [];
  const initialAccumulator =
    initial === undefined
      ? canonicalValueCallbackElementSegment(first)
      : ({ elements: [initial], kind: "direct" } as const);
  const returnedAccumulators = input
    .callable(input.runtime, input.callback)
    .flatMap((candidate) => {
      const node = candidate.node;
      if (
        node.type !== "ArrowFunctionExpression" &&
        node.type !== "FunctionDeclaration" &&
        node.type !== "FunctionExpression"
      ) {
        return [];
      }
      return input.functionReturnResults(node).map(
        (expression): CanonicalValueCallArgumentSegment => ({
          expression,
          kind: "source",
          sourcePath: [],
        }),
      );
    });
  return [initialAccumulator, ...returnedAccumulators].flatMap((accumulator) =>
    elements.map((arguments_) => [
      accumulator,
      canonicalValueCallbackElementSegment(arguments_),
      arguments_[1] ?? { kind: "unknown", width: 1 },
      { kind: "unknown", width: 1 },
    ]),
  );
};

const comparatorArgumentSets = (
  input: CanonicalValueCallbackArguments,
): readonly (readonly CanonicalValueCallArgumentSegment[])[] => {
  if (input.arguments.length < 2) return [];
  return input.arguments.flatMap((left) =>
    input.arguments.map((right) => [
      canonicalValueCallbackElementSegment(left),
      canonicalValueCallbackElementSegment(right),
    ]),
  );
};

const methodArgumentSets = (
  input: CanonicalValueCallbackRuntime & {
    readonly arguments: CanonicalValueCallbackArguments;
    readonly callback: ESTree.Expression;
    readonly invocation: CanonicalValueEffectiveCall;
  },
  name: string,
): readonly (readonly CanonicalValueCallArgumentSegment[])[] => {
  if (name === "reduce" || name === "reduceRight") {
    return reduceArgumentSets({ ...input, fromRight: name === "reduceRight" });
  }
  return name === "sort" || name === "toSorted"
    ? comparatorArgumentSets(input.arguments)
    : input.arguments.arguments;
};

const isGlobalArray = (
  input: CanonicalValueCallbackRuntime,
  expression: ESTree.Expression,
): expression is ESTree.IdentifierReference =>
  expression.type === "Identifier" &&
  expression.name === "Array" &&
  (input.runtime.resolveIdentifier(expression)?.defs.length ?? 0) === 0;

const arrayFromCallback = (
  input: CanonicalValueCallbackRuntime & { readonly invocation: CanonicalValueEffectiveCall },
): {
  readonly argumentSets: readonly (readonly CanonicalValueCallArgumentSegment[])[];
  readonly callback: ESTree.Expression;
} | null => {
  const callee = unwrapExpression(input.invocation.target);
  if (callee.type !== "MemberExpression" || callee.object.type === "Super") return null;
  if (!isGlobalArray(input, callee.object)) return null;
  if (canonicalValueStaticMemberName(callee) !== "from") return null;
  const runtime = canonicalValueCallbackStandardCallRuntime(input);
  const source = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 0,
    invocation: input.invocation,
  })[0];
  const callback = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 1,
    invocation: input.invocation,
  })[0];
  if (source === undefined || callback === undefined) return null;
  const arguments_ = canonicalValueCallbackArguments(input, { expression: source });
  return {
    argumentSets: arguments_.arguments.map((segments) => [
      canonicalValueCallbackElementSegment(segments),
      segments[1] ?? { kind: "unknown", width: 1 },
    ]),
    callback,
  };
};

type CallbackInvocation = NonNullable<ReturnType<typeof arrayFromCallback>>;

const arrayMethodCallback = (
  input: CanonicalValueCallbackRuntime & {
    readonly callee: ESTree.MemberExpression;
    readonly invocation: CanonicalValueEffectiveCall;
  },
): CallbackInvocation | null => {
  const name = canonicalValueStaticMemberName(input.callee);
  if (name === null || !ARRAY_CALLBACK_METHODS.some((method) => method === name)) return null;
  const callback = canonicalValueEffectiveCallArgumentExpressions(
    canonicalValueCallbackStandardCallRuntime(input),
    {
      index: 0,
      invocation: input.invocation,
    },
  )[0];
  if (callback === undefined) return null;
  const receiver = input.invocation.thisArgument ?? input.callee.object;
  if (
    knownCustomCollectionReceiver(input, input.callee.object) ||
    knownCustomCollectionReceiver(input, receiver)
  ) {
    return null;
  }
  const resolvedArguments = canonicalValueCallbackArguments(input, {
    expression: receiver,
    skipArrayHoles: true,
  });
  const callbackArguments_ = resolvedArguments.recognized
    ? resolvedArguments
    : { arguments: [canonicalValueUnknownCallbackArguments()], recognized: false };
  return {
    argumentSets: methodArgumentSets({ ...input, arguments: callbackArguments_, callback }, name),
    callback,
  };
};

const knownCustomCollectionReceiver = (
  input: CanonicalValueCallbackRuntime,
  rawExpression: ESTree.Expression,
): boolean => {
  const expression = unwrapExpression(rawExpression);
  if (expression.type === "ObjectExpression") return true;
  if (expression.type === "ArrayExpression") return false;
  if (expression.type === "Literal") return true;
  if (expression.type === "NewExpression") {
    return !canonicalValueCallbackArguments(input, {
      expression,
      skipArrayHoles: true,
    }).recognized;
  }
  if (expression.type !== "Identifier") return false;
  const sources = input.identifierSources(input.runtime, expression);
  return (
    sources.length !== 0 &&
    sources.every(({ runtime, source }) =>
      knownCustomCollectionReceiver({ ...input, runtime }, source),
    )
  );
};

const calledCallbacks = (
  input: CanonicalValueCallbackRuntime & { readonly call: ESTree.CallExpression },
  invocation: CallbackInvocation,
): readonly CanonicalValueCalledFunction[] =>
  uniqBy(callbackCandidates({ ...input, ...invocation }), callbackCandidateKey).map(
    (candidate) => ({
      ...candidate,
      source: input.call,
    }),
  );

export const canonicalValueArrayCallbackFunctions = (
  input: CanonicalValueCallbackRuntime & { readonly call: ESTree.CallExpression },
): readonly CanonicalValueCalledFunction[] =>
  canonicalValueEffectiveCalls(
    canonicalValueCallbackStandardCallRuntime(input),
    input.call,
  ).flatMap((invocation) => {
    const direct = arrayFromCallback({ ...input, invocation });
    if (direct !== null) return calledCallbacks(input, direct);
    const callee = unwrapExpression(invocation.target);
    if (callee.type !== "MemberExpression" || callee.object.type === "Super") return [];
    const callback = arrayMethodCallback({ ...input, callee, invocation });
    return callback === null ? [] : calledCallbacks(input, callback);
  });
