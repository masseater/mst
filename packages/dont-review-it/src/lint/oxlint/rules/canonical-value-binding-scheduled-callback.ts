import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueStaticMemberName } from "./canonical-value-binding-member-call.ts";
import {
  canonicalValueEffectiveCallArgumentExpressions,
  canonicalValueEffectiveCallArgumentsAfter,
} from "./canonical-value-binding-standard-arguments.ts";
import {
  canonicalValueEffectiveCalls,
  type CanonicalValueEffectiveCall,
} from "./canonical-value-binding-standard-call.ts";
import { canonicalValueCallbackStandardCallRuntime } from "./canonical-value-binding-standard-runtime.ts";
import { canonicalValueIsGlobalIdentifier } from "./canonical-value-global-identifier.ts";
import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";
import { canonicalValueImportedDefinitionName } from "./canonical-value-imported-name.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueCalledFunction,
  CanonicalValueResultCallbackRuntime,
} from "./canonical-value-binding-call-types.ts";

type ScheduledRuntime = CanonicalValueResultCallbackRuntime;

const GLOBAL_SCHEDULES = new Map<string, number>([
  ["queueMicrotask", Number.POSITIVE_INFINITY],
  ["setImmediate", 1],
  ["setInterval", 2],
  ["setTimeout", 2],
]);

const importedSchedule = (
  input: ScheduledRuntime,
  identifier: ESTree.IdentifierReference,
): number | null => {
  const binding = input.runtime.resolveIdentifier(identifier);
  if (binding === null) return null;
  for (const definition of binding.defs) {
    const declaration = canonicalValueImportDeclarationOf(definition);
    if (declaration?.source.value !== "node:timers") continue;
    const imported = canonicalValueImportedDefinitionName(definition);
    const kind = imported === null ? undefined : GLOBAL_SCHEDULES.get(imported);
    if (kind !== undefined) return kind;
  }
  return null;
};

const namespaceIsTimers = (
  input: ScheduledRuntime,
  identifier: ESTree.IdentifierReference,
): boolean => {
  const binding = input.runtime.resolveIdentifier(identifier);
  return (
    binding?.defs.some(
      (definition) =>
        definition.node.type === "ImportNamespaceSpecifier" &&
        canonicalValueImportDeclarationOf(definition)?.source.value === "node:timers",
    ) ?? false
  );
};

const globalMemberSchedule = (
  input: ScheduledRuntime,
  member: ESTree.MemberExpression & { readonly object: ESTree.Expression },
): number | null => {
  const name = canonicalValueStaticMemberName(member);
  if (name === null) return null;
  if (
    canonicalValueIsGlobalIdentifier(input.runtime, {
      expression: member.object,
      name: "globalThis",
    })
  ) {
    return GLOBAL_SCHEDULES.get(name) ?? null;
  }
  if (
    name === "nextTick" &&
    canonicalValueIsGlobalIdentifier(input.runtime, { expression: member.object, name: "process" })
  ) {
    return 1;
  }
  return member.object.type === "Identifier" && namespaceIsTimers(input, member.object)
    ? (GLOBAL_SCHEDULES.get(name) ?? null)
    : null;
};

const directScheduleKind = (
  input: ScheduledRuntime,
  expression: ESTree.Expression,
): number | null => {
  const target = unwrapExpression(expression);
  if (target.type === "Identifier") {
    for (const [name, kind] of GLOBAL_SCHEDULES) {
      if (canonicalValueIsGlobalIdentifier(input.runtime, { expression: target, name }))
        return kind;
    }
    return importedSchedule(input, target);
  }
  return target.type === "MemberExpression" && target.object.type !== "Super"
    ? globalMemberSchedule(input, target)
    : null;
};

const scheduleArgumentStarts = (
  input: ScheduledRuntime,
  expression: ESTree.Expression,
): readonly number[] => {
  const direct = directScheduleKind(input, expression);
  if (direct !== null) return [direct];
  const target = unwrapExpression(expression);
  if (target.type !== "Identifier") return [];
  return uniqBy(
    input
      .identifierSources(input.runtime, target)
      .flatMap(({ runtime, source }) => scheduleArgumentStarts({ ...input, runtime }, source)),
    (startIndex) => startIndex,
  );
};

const callbackCandidates = (
  input: ScheduledRuntime & {
    readonly invocation: CanonicalValueEffectiveCall;
    readonly startIndex: number;
  },
): readonly CanonicalValueCallableCandidate[] => {
  const runtime = canonicalValueCallbackStandardCallRuntime(input);
  const callback = canonicalValueEffectiveCallArgumentExpressions(runtime, {
    index: 0,
    invocation: input.invocation,
  })[0];
  if (callback === undefined) return [];
  const argumentSegments = Number.isFinite(input.startIndex)
    ? canonicalValueEffectiveCallArgumentsAfter(runtime, {
        invocation: input.invocation,
        startIndex: input.startIndex,
      })
    : [];
  return input.callable(input.runtime, callback).map((candidate) => ({
    ...candidate,
    argumentSegments: [...candidate.argumentSegments, ...argumentSegments],
  }));
};

const candidateKey = (candidate: CanonicalValueCallableCandidate): string =>
  `${candidate.node.start}:${candidate.argumentSegments
    .map((segment) => (segment.kind === "unknown" ? "unknown" : segment.kind))
    .join("|")}`;

export const canonicalValueScheduledCallbackFunctions = (
  input: ScheduledRuntime & { readonly call: ESTree.CallExpression },
): readonly CanonicalValueCalledFunction[] =>
  uniqBy(
    canonicalValueEffectiveCalls(
      canonicalValueCallbackStandardCallRuntime(input),
      input.call,
    ).flatMap((invocation) =>
      scheduleArgumentStarts(input, invocation.target).flatMap((startIndex) =>
        callbackCandidates({ ...input, invocation, startIndex }),
      ),
    ),
    candidateKey,
  ).map((candidate) => ({ ...candidate, source: input.call }));
