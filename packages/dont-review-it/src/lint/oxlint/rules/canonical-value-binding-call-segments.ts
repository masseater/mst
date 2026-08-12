import type { ESTree } from "@oxlint/plugins";
import type {
  CanonicalValueCallArgumentSegment,
  CanonicalValueYieldResult,
} from "./canonical-value-binding-types.ts";

export const canonicalValueDirectCallArgumentSegments = (
  elements: readonly ESTree.Argument[],
): readonly CanonicalValueCallArgumentSegment[] =>
  elements.length === 0 ? [] : [{ elements, kind: "direct" }];

export const canonicalValueAppendCallArgumentSegments = (
  left: readonly CanonicalValueCallArgumentSegment[],
  right: readonly CanonicalValueCallArgumentSegment[],
): readonly CanonicalValueCallArgumentSegment[] => [...left, ...right];

export const canonicalValueYieldCallArgumentSegments = (
  results: readonly CanonicalValueYieldResult[],
): readonly CanonicalValueCallArgumentSegment[] =>
  results.map((result) =>
    result.delegate
      ? { expression: result.expression, kind: "array" }
      : { elements: [result.expression], kind: "direct" },
  );
