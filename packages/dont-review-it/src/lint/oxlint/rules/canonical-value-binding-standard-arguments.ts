import { uniqBy } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { canonicalValueDirectCallArgumentSegments } from "./canonical-value-binding-call-segments.ts";
import { type CanonicalValueStandardCallRuntime } from "./canonical-value-binding-standard-runtime.ts";
import { canonicalValueCallArgumentSources } from "./canonical-value-call-arguments.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueCallArgumentSegment } from "./canonical-value-binding-types.ts";

const arrayIndexExpressions = (
  runtime: CanonicalValueStandardCallRuntime,
  input: { readonly expression: ESTree.Expression; readonly index: number },
): readonly ESTree.Expression[] => {
  const unwrapped = unwrapExpression(input.expression);
  if (unwrapped.type === "ArrayExpression") {
    const element = unwrapped.elements[input.index];
    return element === null || element === undefined || element.type === "SpreadElement"
      ? []
      : [element];
  }
  if (unwrapped.type !== "Identifier") return [];
  return runtime
    .identifierSources(runtime, unwrapped)
    .flatMap(({ runtime: next, source }) =>
      arrayIndexExpressions({ ...runtime, ...next }, { expression: source, index: input.index }),
    );
};

const argumentExpressions = (
  runtime: CanonicalValueStandardCallRuntime,
  input: {
    readonly index: number;
    readonly segments: readonly CanonicalValueCallArgumentSegment[];
  },
): readonly ESTree.Expression[] =>
  uniqBy(
    canonicalValueCallArgumentSources(input.segments, input.index).flatMap((source) => {
      if (source.sourcePath.length === 0) return [source.expression];
      const [path] = source.sourcePath;
      return path?.kind === "array-index" && source.sourcePath.length === 1
        ? arrayIndexExpressions(runtime, { expression: source.expression, index: path.index })
        : [];
    }),
    (expression) => expression,
  );

const aliasedDirectElements = (
  runtime: CanonicalValueStandardCallRuntime,
  expression: ESTree.IdentifierReference,
): readonly ESTree.Argument[] | null => {
  const sources = runtime.identifierSources(runtime, expression);
  const [source] = sources;
  return sources.length === 1 && source !== undefined
    ? directElements({ ...runtime, ...source.runtime }, [
        { expression: source.source, kind: "array" },
      ])
    : null;
};

const directElements = (
  runtime: CanonicalValueStandardCallRuntime,
  segments: readonly CanonicalValueCallArgumentSegment[],
): readonly ESTree.Argument[] | null => {
  const direct = segments.filter(
    (segment): segment is Extract<CanonicalValueCallArgumentSegment, { readonly kind: "direct" }> =>
      segment.kind === "direct",
  );
  if (direct.length === segments.length) {
    return direct.flatMap((segment) => segment.elements);
  }
  if (segments.length !== 1 || segments[0]?.kind !== "array") return null;
  const expression = unwrapExpression(segments[0].expression);
  if (
    expression.type === "ArrayExpression" &&
    expression.elements.every((element) => element !== null)
  ) {
    return expression.elements;
  }
  return expression.type === "Identifier" ? aliasedDirectElements(runtime, expression) : null;
};

const argumentsAfter = (
  runtime: CanonicalValueStandardCallRuntime,
  input: {
    readonly segments: readonly CanonicalValueCallArgumentSegment[];
    readonly startIndex: number;
  },
): readonly CanonicalValueCallArgumentSegment[] => {
  const elements = directElements(runtime, input.segments);
  return elements === null
    ? [{ kind: "unknown" }]
    : canonicalValueDirectCallArgumentSegments(elements.slice(input.startIndex));
};

export const canonicalValueEffectiveCallArgumentExpressions = (
  runtime: CanonicalValueStandardCallRuntime,
  input: {
    readonly index: number;
    readonly invocation: {
      readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
    };
  },
): readonly ESTree.Expression[] =>
  argumentExpressions(runtime, {
    index: input.index,
    segments: input.invocation.argumentSegments,
  });

export const canonicalValueEffectiveCallArgumentsAfter = (
  runtime: CanonicalValueStandardCallRuntime,
  input: {
    readonly invocation: {
      readonly argumentSegments: readonly CanonicalValueCallArgumentSegment[];
    };
    readonly startIndex: number;
  },
): readonly CanonicalValueCallArgumentSegment[] =>
  argumentsAfter(runtime, {
    segments: input.invocation.argumentSegments,
    startIndex: input.startIndex,
  });
