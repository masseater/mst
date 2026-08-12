import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  canonicalValueCallbackElementSegment,
  canonicalValueUnknownCallbackArguments,
} from "./canonical-value-binding-callback-argument-set.ts";
import { canonicalValueCallbackArguments } from "./canonical-value-binding-callback-arguments.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueEffectiveCallArgumentExpressions } from "./canonical-value-binding-standard-arguments.ts";
import {
  canonicalValueEffectiveCalls,
  type CanonicalValueEffectiveCall,
} from "./canonical-value-binding-standard-call.ts";
import { canonicalValueCallbackStandardCallRuntime } from "./canonical-value-binding-standard-runtime.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { canonicalValueStaticRegexp } from "./canonical-value-static-regexp.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueCalledFunction,
  CanonicalValueResultCallbackRuntime,
} from "./canonical-value-binding-call-types.ts";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";

type StandardCallbackRuntime = CanonicalValueResultCallbackRuntime;

type StandardCallback = {
  readonly argumentSets: readonly (readonly CanonicalValueCallArgumentSegment[])[];
  readonly callback: ESTree.Expression;
};

const logicalArgument = (
  input: StandardCallbackRuntime & {
    readonly index: number;
    readonly invocation: CanonicalValueEffectiveCall;
  },
): ESTree.Expression | null =>
  canonicalValueEffectiveCallArgumentExpressions(canonicalValueCallbackStandardCallRuntime(input), {
    index: input.index,
    invocation: input.invocation,
  })[0] ?? null;

const globalMemberName = (
  input: StandardCallbackRuntime & {
    readonly expression: ESTree.Expression;
    readonly owner: string;
  },
): string | null => {
  const member = unwrapExpression(input.expression);
  if (member.type !== "MemberExpression" || member.object.type === "Super") return null;
  return canonicalValueIsGlobalIdentifier(input.runtime, {
    expression: member.object,
    name: input.owner,
  })
    ? canonicalValueStaticMemberName(member)
    : null;
};

const staticStrings = (
  input: StandardCallbackRuntime,
  rawExpression: ESTree.Expression,
): readonly string[] => {
  const expression = unwrapExpression(rawExpression);
  if (expression.type === "Literal" && typeof expression.value === "string") {
    return [expression.value];
  }
  if (expression.type === "Identifier") {
    return uniqBy(
      input
        .identifierSources(input.runtime, expression)
        .flatMap(({ runtime, source }) => staticStrings({ ...input, runtime }, source)),
      (value) => value,
    );
  }
  if (expression.type === "ConditionalExpression") {
    return uniqBy(
      [
        ...staticStrings(input, expression.consequent),
        ...staticStrings(input, expression.alternate),
      ],
      (value) => value,
    );
  }
  const last = expression.type === "SequenceExpression" ? expression.expressions.at(-1) : undefined;
  return last === undefined ? [] : staticStrings(input, last);
};

const staticRegexps = (
  input: StandardCallbackRuntime,
  rawExpression: ESTree.Expression,
): readonly RegExp[] => {
  const expression = unwrapExpression(rawExpression);
  const direct = canonicalValueStaticRegexp(expression);
  if (direct !== null) return [direct];
  if (expression.type === "Identifier") {
    return uniqBy(
      input
        .identifierSources(input.runtime, expression)
        .flatMap(({ runtime, source }) => staticRegexps({ ...input, runtime }, source)),
      (regexp) => `${regexp.source}/${regexp.flags}`,
    );
  }
  if (expression.type === "ConditionalExpression") {
    return uniqBy(
      [
        ...staticRegexps(input, expression.consequent),
        ...staticRegexps(input, expression.alternate),
      ],
      (regexp) => `${regexp.source}/${regexp.flags}`,
    );
  }
  const last = expression.type === "SequenceExpression" ? expression.expressions.at(-1) : undefined;
  return last === undefined ? [] : staticRegexps(input, last);
};

const knownCustomReceiver = (
  input: StandardCallbackRuntime,
  rawExpression: ESTree.Expression,
): boolean => {
  const expression = unwrapExpression(rawExpression);
  if (expression.type === "ObjectExpression" || expression.type === "ArrayExpression") return true;
  if (expression.type === "Literal") return typeof expression.value !== "string";
  if (expression.type !== "Identifier") return false;
  const sources = input.identifierSources(input.runtime, expression);
  return (
    sources.length !== 0 &&
    sources.every(({ runtime, source }) => knownCustomReceiver({ ...input, runtime }, source))
  );
};

const stringMethodName = (
  input: StandardCallbackRuntime,
  invocation: CanonicalValueEffectiveCall,
): "replace" | "replaceAll" | null => {
  const target = unwrapExpression(invocation.target);
  if (target.type !== "MemberExpression" || target.object.type === "Super") return null;
  const name = canonicalValueStaticMemberName(target);
  if (name !== "replace" && name !== "replaceAll") return null;
  const receiver = invocation.thisArgument ?? target.object;
  return knownCustomReceiver(input, receiver) ? null : name;
};

const regexpCallbackCount = (input: {
  readonly name: "replace" | "replaceAll";
  readonly receivers: readonly string[];
  readonly regexps: readonly RegExp[];
}): number | null => {
  if (input.receivers.length === 0 || input.regexps.length === 0) return null;
  return input.receivers
    .flatMap((receiverText) =>
      input.regexps.map((regexp) => {
        if (input.name === "replaceAll" && !regexp.global) return 0;
        if (!regexp.global) return regexp.test(receiverText) ? 1 : 0;
        return Array.from(receiverText.matchAll(regexp)).length;
      }),
    )
    .reduce((maximum, count) => Math.max(maximum, count), 0);
};

const literalSearchCallbackCount = (input: {
  readonly name: "replace" | "replaceAll";
  readonly receivers: readonly string[];
  readonly searches: readonly string[];
}): number => {
  if (input.receivers.length === 0 || input.searches.length === 0) return 1;
  if (input.name === "replace") {
    return input.receivers.some((receiverText) =>
      input.searches.some((needle) => receiverText.includes(needle)),
    )
      ? 1
      : 0;
  }
  return input.receivers
    .flatMap((receiverText) =>
      input.searches.map((needle) =>
        needle === "" ? receiverText.length + 1 : receiverText.split(needle).length - 1,
      ),
    )
    .reduce((maximum, count) => Math.max(maximum, count), 0);
};

const stringCallbackCount = (
  input: StandardCallbackRuntime & {
    readonly invocation: CanonicalValueEffectiveCall;
    readonly name: "replace" | "replaceAll";
  },
): number => {
  const target = unwrapExpression(input.invocation.target);
  if (target.type !== "MemberExpression" || target.object.type === "Super") return 0;
  const receiver = input.invocation.thisArgument ?? target.object;
  const receivers = staticStrings(input, receiver);
  const search = logicalArgument({ ...input, index: 0 });
  const regexps = search === null ? [] : staticRegexps(input, search);
  const regexpCount = regexpCallbackCount({ ...input, receivers, regexps });
  if (regexpCount !== null) return regexpCount;
  const searches = search === null ? [] : staticStrings(input, search);
  return literalSearchCallbackCount({ ...input, receivers, searches });
};

const stringCallback = (
  input: StandardCallbackRuntime,
  invocation: CanonicalValueEffectiveCall,
): StandardCallback | null => {
  const name = stringMethodName(input, invocation);
  if (name === null) return null;
  const callback = logicalArgument({ ...input, index: 1, invocation });
  if (callback === null) return null;
  return {
    argumentSets: Array.from(
      { length: stringCallbackCount({ ...input, invocation, name }) },
      canonicalValueUnknownCallbackArguments,
    ),
    callback,
  };
};

const groupCallback = (
  input: StandardCallbackRuntime,
  invocation: CanonicalValueEffectiveCall,
): StandardCallback | null => {
  const owner =
    globalMemberName({ ...input, expression: invocation.target, owner: "Object" }) === "groupBy"
      ? "Object"
      : "Map";
  if (globalMemberName({ ...input, expression: invocation.target, owner }) !== "groupBy")
    return null;
  const source = logicalArgument({ ...input, index: 0, invocation });
  const callback = logicalArgument({ ...input, index: 1, invocation });
  if (source === null || callback === null) return null;
  const arguments_ = canonicalValueCallbackArguments(input, { expression: source });
  const argumentSets = arguments_.recognized
    ? arguments_.arguments.map((segments) => [
        canonicalValueCallbackElementSegment(segments),
        segments[1] ?? { kind: "unknown", width: 1 },
      ])
    : [canonicalValueUnknownCallbackArguments()];
  return { argumentSets, callback };
};

const parsesJson = (source: string): boolean => {
  try {
    JSON.parse(source);
    return true;
  } catch (failure) {
    if (failure instanceof SyntaxError) return false;
    throw failure;
  }
};

const jsonCallback = (
  input: StandardCallbackRuntime,
  invocation: CanonicalValueEffectiveCall,
): StandardCallback | null => {
  const name = globalMemberName({ ...input, expression: invocation.target, owner: "JSON" });
  if (name !== "parse" && name !== "stringify") return null;
  const callback = logicalArgument({ ...input, index: 1, invocation });
  if (callback === null) return null;
  if (name === "parse") {
    const source = logicalArgument({ ...input, index: 0, invocation });
    const jsonSources = source === null ? [] : staticStrings(input, source);
    if (jsonSources.length !== 0 && jsonSources.every((jsonSource) => !parsesJson(jsonSource))) {
      return { argumentSets: [], callback };
    }
  }
  return { argumentSets: [canonicalValueUnknownCallbackArguments()], callback };
};

const callbackCandidateKey = (candidate: CanonicalValueCallableCandidate): string =>
  `${candidate.node.start}:${candidate.argumentSegments.length}`;

const calledCallbacks = (
  input: StandardCallbackRuntime & { readonly call: ESTree.CallExpression },
  callback: StandardCallback,
): readonly CanonicalValueCalledFunction[] =>
  uniqBy(
    callback.argumentSets.flatMap((arguments_) =>
      input.callable(input.runtime, callback.callback).map((candidate) => ({
        ...candidate,
        argumentSegments: [...candidate.argumentSegments, ...arguments_],
      })),
    ),
    callbackCandidateKey,
  ).map((candidate) => ({ ...candidate, source: input.call }));

export const canonicalValueStandardCallbackFunctions = (
  input: StandardCallbackRuntime & { readonly call: ESTree.CallExpression },
): readonly CanonicalValueCalledFunction[] =>
  canonicalValueEffectiveCalls(
    canonicalValueCallbackStandardCallRuntime(input),
    input.call,
  ).flatMap((invocation) => {
    const callback =
      groupCallback(input, invocation) ??
      stringCallback(input, invocation) ??
      jsonCallback(input, invocation);
    return callback === null ? [] : calledCallbacks(input, callback);
  });
