import { sum } from "es-toolkit";

import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";

import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallArgumentSegment,
  CanonicalValueSourcePath,
} from "./canonical-value-binding-types.ts";

export type CanonicalValueCallArgumentPart =
  | { readonly expression: ESTree.Expression; readonly kind: "many" }
  | {
      readonly expression: ESTree.Expression;
      readonly kind: "one";
      readonly sourcePath: CanonicalValueSourcePath;
    }
  | { readonly kind: "unknown"; readonly width: number | null };

export type CanonicalValueCallArgumentSource = {
  readonly expression: ESTree.Expression;
  readonly sourcePath: CanonicalValueSourcePath;
};

export const canonicalValueArgumentExpression = (
  argument: ESTree.Argument | undefined,
): ESTree.Expression | null =>
  argument === undefined || argument.type === "SpreadElement" ? null : argument;

const segmentParts = (
  segment: CanonicalValueCallArgumentSegment,
): readonly CanonicalValueCallArgumentPart[] => {
  if (segment.kind === "array") return [{ expression: segment.expression, kind: "many" }];
  if (segment.kind === "unknown") return [{ kind: "unknown", width: segment.width ?? null }];
  if (segment.kind === "source") {
    return [{ expression: segment.expression, kind: "one", sourcePath: segment.sourcePath }];
  }
  return segment.elements.map((element) =>
    element.type === "SpreadElement"
      ? { expression: element.argument, kind: "many" }
      : { expression: element, kind: "one", sourcePath: [] },
  );
};

export const canonicalValueCallArgumentParts = (
  segments: readonly CanonicalValueCallArgumentSegment[],
): readonly CanonicalValueCallArgumentPart[] => segments.flatMap(segmentParts);

const arrayElementWidth = (element: ESTree.ArrayExpression["elements"][number]): number | null =>
  element?.type === "SpreadElement" ? staticArrayWidth(element.argument) : 1;

const staticArrayWidth = (expression: ESTree.Expression): number | null => {
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type !== "ArrayExpression") return null;
  const widths = unwrapped.elements.map(arrayElementWidth);
  return widths.some((width) => width === null) ? null : sum(widths as number[]);
};

const continuationSources = (input: {
  readonly index: number;
  readonly parts: readonly CanonicalValueCallArgumentPart[];
  readonly width: number | null;
}): readonly CanonicalValueCallArgumentSource[] =>
  input.width === null
    ? Array.from({ length: input.index + 1 }, (_, width) =>
        callArgumentSourcesFromParts(input.parts, input.index - width),
      ).flat()
    : input.width <= input.index
      ? callArgumentSourcesFromParts(input.parts, input.index - input.width)
      : [];

const callArgumentSourcesFromParts = (
  parts: readonly CanonicalValueCallArgumentPart[],
  index: number,
): readonly CanonicalValueCallArgumentSource[] => {
  const [part, ...remaining] = parts;
  if (part === undefined) return [];
  if (part.kind === "one") {
    return index === 0
      ? [{ expression: part.expression, sourcePath: part.sourcePath }]
      : callArgumentSourcesFromParts(remaining, index - 1);
  }
  const width = part.kind === "unknown" ? part.width : staticArrayWidth(part.expression);
  const continuations = continuationSources({ index, parts: remaining, width });
  if (part.kind === "unknown" || (width !== null && index >= width)) return continuations;
  return [
    { expression: part.expression, sourcePath: [{ index, kind: "array-index" }] },
    ...continuations,
  ];
};

export const canonicalValueCallArgumentSources = (
  segments: readonly CanonicalValueCallArgumentSegment[],
  index: number,
): readonly CanonicalValueCallArgumentSource[] =>
  callArgumentSourcesFromParts(canonicalValueCallArgumentParts(segments), index);

export const canonicalValueCallArgumentsHaveKnownWidths = (
  segments: readonly CanonicalValueCallArgumentSegment[],
): boolean =>
  canonicalValueCallArgumentParts(segments).every(
    (part) =>
      part.kind === "one" ||
      (part.kind === "many" && staticArrayWidth(part.expression) !== null) ||
      (part.kind === "unknown" && part.width !== null),
  );

const restSourcePath = (startIndex: number): CanonicalValueSourcePath =>
  startIndex === 0 ? [] : [{ kind: "array-rest", startIndex }];

const arrayRestSource = (
  segment: CanonicalValueCallArgumentSegment,
  startIndex: number,
): CanonicalValueCallArgumentSource | null =>
  segment.kind === "array"
    ? { expression: segment.expression, sourcePath: restSourcePath(startIndex) }
    : null;

const spreadRestSource = (
  segment: CanonicalValueCallArgumentSegment,
  startIndex: number,
): CanonicalValueCallArgumentSource | null => {
  if (segment.kind !== "direct" || segment.elements.length !== 1) return null;
  const [element] = segment.elements;
  return element?.type === "SpreadElement"
    ? { expression: element.argument, sourcePath: restSourcePath(startIndex) }
    : null;
};

export const canonicalValueDirectRestSource = (
  segments: readonly CanonicalValueCallArgumentSegment[],
  startIndex: number,
): CanonicalValueCallArgumentSource | null => {
  const [segment] = segments;
  if (segment === undefined || segments.length !== 1) return null;
  return arrayRestSource(segment, startIndex) ?? spreadRestSource(segment, startIndex);
};
