import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import {
  combineCanonicalValueCallbackArguments,
  canonicalValueCallbackAliasExpressions,
  canonicalValueElementCallbackArguments,
  type CanonicalValueCallbackArguments,
  type CanonicalValueCallbackRuntime,
} from "./canonical-value-binding-callback-argument-set.ts";
import {
  canonicalValueEnumeratedForInSources,
  canonicalValueForInSources,
} from "./canonical-value-binding-iteration.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import { canonicalValueEffectiveCallArgumentExpressions } from "./canonical-value-binding-standard-arguments.ts";
import { canonicalValueEffectiveCalls } from "./canonical-value-binding-standard-call.ts";
import {
  canonicalValueCallbackStandardCallRuntime,
  type CanonicalValueStandardCallRuntime,
} from "./canonical-value-binding-standard-runtime.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSource } from "./canonical-value-call-arguments.ts";

const standardObjectExpression = (
  runtime: CanonicalValueStandardCallRuntime,
  expression: ESTree.Expression,
): boolean => {
  const unwrapped = unwrapExpression(expression);
  if (canonicalValueIsGlobalIdentifier(runtime, { expression: unwrapped, name: "Object" })) {
    return true;
  }
  if (unwrapped.type !== "MemberExpression" || unwrapped.object.type === "Super") return false;
  return (
    canonicalValueStaticMemberName(unwrapped) === "Object" &&
    canonicalValueIsGlobalIdentifier(runtime, {
      expression: unwrapped.object,
      name: "globalThis",
    })
  );
};

const standardObjectMethodTarget = (
  input: CanonicalValueCallbackRuntime,
  query: {
    readonly expression: ESTree.Expression;
    readonly method: "entries" | "keys";
    readonly runtime: CanonicalValueStandardCallRuntime;
    readonly seen: ReadonlySet<ESTree.Expression>;
  },
): boolean => {
  const expression = unwrapExpression(query.expression);
  if (query.seen.has(expression)) return false;
  if (expression.type === "MemberExpression" && expression.object.type !== "Super") {
    return (
      canonicalValueStaticMemberName(expression) === query.method &&
      standardObjectExpression(query.runtime, expression.object)
    );
  }
  if (expression.type !== "Identifier") return false;
  const sources = input.identifierSources(query.runtime, expression);
  if (sources.length === 0) return false;
  const seen = new Set([...query.seen, expression]);
  return sources.every(({ runtime, source }) =>
    standardObjectMethodTarget(input, {
      ...query,
      expression: source,
      runtime: { ...query.runtime, ...runtime },
      seen,
    }),
  );
};

const objectEnumerationInvocations = (
  input: CanonicalValueCallbackRuntime,
  query: {
    readonly expression: ESTree.CallExpression;
    readonly method: "entries" | "keys";
  },
): ReturnType<typeof canonicalValueEffectiveCalls> => {
  const runtime = canonicalValueCallbackStandardCallRuntime(input);
  return canonicalValueEffectiveCalls(runtime, query.expression).filter((invocation) =>
    standardObjectMethodTarget(input, {
      expression: invocation.target,
      method: query.method,
      runtime,
      seen: new Set(),
    }),
  );
};

const objectArgument = (
  input: CanonicalValueCallbackRuntime,
  invocation: ReturnType<typeof canonicalValueEffectiveCalls>[number],
): ESTree.Expression | null =>
  canonicalValueEffectiveCallArgumentExpressions(canonicalValueCallbackStandardCallRuntime(input), {
    index: 0,
    invocation,
  })[0] ?? null;

const objectKeysCallbackArguments = (
  input: CanonicalValueCallbackRuntime,
  expression: ESTree.CallExpression,
): CanonicalValueCallbackArguments | null => {
  const invocations = objectEnumerationInvocations(input, { expression, method: "keys" });
  if (invocations.length === 0) return null;
  return combineCanonicalValueCallbackArguments(
    invocations.map((invocation) => {
      const argument = objectArgument(input, invocation);
      const sources =
        argument?.type === "ObjectExpression"
          ? canonicalValueForInSources({
              resolveAlias: (identifier) =>
                canonicalValueCallbackAliasExpressions(input, identifier),
              source: argument,
            })
          : [{ expression, sourcePath: [{ kind: "array-element" }] as const }];
      return {
        arguments: sources.map(canonicalValueElementCallbackArguments),
        recognized: true,
      };
    }),
  );
};

const syntheticEntries = new WeakMap<ESTree.Node, Map<string, ESTree.ArrayExpression>>();

const syntheticEntryKey = (expression: ESTree.Expression): string =>
  `${expression.type}:${expression.start}:${expression.end}:${expression.type === "Literal" ? String(expression.value) : ""}`;

const syntheticEntry = (source: CanonicalValueCallArgumentSource): ESTree.ArrayExpression => {
  const owner = source.expression.parent;
  const entries = syntheticEntries.get(owner) ?? new Map<string, ESTree.ArrayExpression>();
  const key = syntheticEntryKey(source.expression);
  const existing = entries.get(key);
  if (existing !== undefined) return existing;
  const expression: ESTree.ArrayExpression = {
    elements: [source.expression],
    end: source.expression.end,
    loc: source.expression.loc,
    parent: owner,
    range: source.expression.range,
    start: source.expression.start,
    type: "ArrayExpression",
  };
  entries.set(key, expression);
  syntheticEntries.set(owner, entries);
  return expression;
};

const objectEntriesCallbackArguments = (
  input: CanonicalValueCallbackRuntime,
  expression: ESTree.CallExpression,
): CanonicalValueCallbackArguments | null => {
  const invocations = objectEnumerationInvocations(input, { expression, method: "entries" });
  if (invocations.length === 0) return null;
  return combineCanonicalValueCallbackArguments(
    invocations.map((invocation) => {
      const argument = objectArgument(input, invocation);
      if (argument?.type !== "ObjectExpression") return { arguments: [], recognized: false };
      const sources = canonicalValueEnumeratedForInSources({
        resolveAlias: (identifier) => canonicalValueCallbackAliasExpressions(input, identifier),
        source: argument,
      });
      return {
        arguments: sources.map((source, index) =>
          canonicalValueElementCallbackArguments(
            { expression: syntheticEntry(source), sourcePath: [] },
            index,
          ),
        ),
        recognized: true,
      };
    }),
  );
};

export const canonicalValueObjectEnumerationCallbackArguments = (
  input: CanonicalValueCallbackRuntime,
  expression: ESTree.CallExpression,
): CanonicalValueCallbackArguments | null =>
  objectKeysCallbackArguments(input, expression) ??
  objectEntriesCallbackArguments(input, expression);
