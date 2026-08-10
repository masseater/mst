import type { GeneratedRegionBoundary } from "../config.ts";

export type SourceRange = {
  readonly startOffset: number;
  readonly endOffset: number;
};

export const generatedRanges = (
  source: string,
  boundaries: readonly GeneratedRegionBoundary[],
): readonly SourceRange[] =>
  boundaries.flatMap((boundary) => {
    const startOffset = source.indexOf(boundary.begin);
    if (startOffset === -1) return [];

    const endIndex = source.indexOf(boundary.end, startOffset);
    if (endIndex === -1) return [];

    return [{ startOffset, endOffset: endIndex + boundary.end.length }];
  });

export const isInsideGeneratedRegion = (
  offset: number | undefined,
  ranges: readonly SourceRange[],
): boolean =>
  offset !== undefined &&
  ranges.some((range) => offset >= range.startOffset && offset < range.endOffset);
