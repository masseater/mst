import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueCallbackAliasExpressions } from "./canonical-value-binding-callback-argument-set.ts";
import { canonicalValueForOfCandidates } from "./canonical-value-binding-iteration.ts";
import { canonicalValueEffectiveCalls } from "./canonical-value-binding-standard-call.ts";
import { canonicalValueCallbackStandardCallRuntime } from "./canonical-value-binding-standard-runtime.ts";
import { canonicalValueCallArgumentParts } from "./canonical-value-call-arguments.ts";
import { canonicalValueFlowSources } from "./canonical-value-expression-flow.ts";
import { canonicalValueImportDeclarationOf } from "./canonical-value-import-definition.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallableCandidate,
  CanonicalValueCallbackRuntime,
  CanonicalValueCalledFunction,
} from "./canonical-value-binding-call-types.ts";

const identifierIsImported = (
  input: CanonicalValueCallbackRuntime,
  identifier: ESTree.IdentifierReference,
): boolean =>
  input.runtime
    .resolveIdentifier(identifier)
    ?.defs.some((definition) => canonicalValueImportDeclarationOf(definition) !== null) ?? false;

const targetIsImported = (
  input: CanonicalValueCallbackRuntime,
  rawExpression: ESTree.Expression,
): boolean => {
  const expression = unwrapExpression(rawExpression);
  if (expression.type === "Identifier") {
    if (identifierIsImported(input, expression)) return true;
    return input
      .identifierSources(input.runtime, expression)
      .some(({ runtime, source }) => targetIsImported({ ...input, runtime }, source));
  }
  if (expression.type === "MemberExpression" && expression.object.type !== "Super") {
    return targetIsImported(input, expression.object);
  }
  const flows = canonicalValueFlowSources(expression);
  return flows?.some((flow) => targetIsImported(input, flow)) ?? false;
};

const argumentExpressions = (
  input: CanonicalValueCallbackRuntime,
  segments: Parameters<typeof canonicalValueCallArgumentParts>[0],
): readonly ESTree.Expression[] =>
  canonicalValueCallArgumentParts(segments).flatMap((part) => {
    if (part.kind === "unknown") return [];
    if (part.kind === "one") return [part.expression];
    return canonicalValueForOfCandidates({
      resolveAlias: (identifier) => canonicalValueCallbackAliasExpressions(input, identifier),
      source: part.expression,
    });
  });

const callbackCandidates = (
  input: CanonicalValueCallbackRuntime & {
    readonly invocation: ReturnType<typeof canonicalValueEffectiveCalls>[number];
  },
): readonly CanonicalValueCallableCandidate[] => {
  if (!targetIsImported(input, input.invocation.target)) return [];
  return argumentExpressions(input, input.invocation.argumentSegments).flatMap((expression) =>
    input.callable(input.runtime, expression).map((candidate) => ({
      ...candidate,
      argumentSegments: [...candidate.argumentSegments, { kind: "unknown" as const }],
    })),
  );
};

export const canonicalValueExternalCallbackFunctions = (
  input: CanonicalValueCallbackRuntime & { readonly call: ESTree.CallExpression },
): readonly CanonicalValueCalledFunction[] =>
  uniqBy(
    canonicalValueEffectiveCalls(
      canonicalValueCallbackStandardCallRuntime(input),
      input.call,
    ).flatMap((invocation) => callbackCandidates({ ...input, invocation })),
    (candidate) => candidate.node,
  ).map((candidate) => ({ ...candidate, source: input.call }));
