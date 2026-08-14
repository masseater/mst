import { resolve, sep } from "node:path";

import { matchesGlobSegment } from "@mst/lint-rule-authoring";
import { range } from "es-toolkit";

import { segmentsOf } from "./path-segments.ts";

const matchesSegments = (
  pathSegments: readonly string[],
  patternSegments: readonly string[],
): boolean => {
  const [head, ...remainingPatternSegments] = patternSegments;
  if (head === undefined) return pathSegments.length === 0;
  if (head === "**") {
    return range(0, pathSegments.length + 1).some((skipped) =>
      matchesSegments(pathSegments.slice(skipped), remainingPatternSegments),
    );
  }

  const [firstPathSegment, ...remainingPathSegments] = pathSegments;
  if (firstPathSegment === undefined) return false;
  if (!matchesGlobSegment({ segment: firstPathSegment, pattern: head })) return false;
  return matchesSegments(remainingPathSegments, remainingPatternSegments);
};

export const matchesAnchoredGlobPath = ({
  relativePath,
  pattern,
}: {
  readonly relativePath: string;
  readonly pattern: string;
}): boolean =>
  matchesSegments(
    segmentsOf({ path: relativePath, separator: "/" }),
    segmentsOf({ path: pattern, separator: "/" }),
  );

const ANCHORED_PATTERN_PREFIXES = ["/", "./", "../"];

export const matchesGlobPath = ({
  pathSegments,
  pattern,
  cwd,
}: {
  readonly pathSegments: readonly string[];
  readonly pattern: string;
  readonly cwd: string;
}): boolean => {
  if (ANCHORED_PATTERN_PREFIXES.some((prefix) => pattern.startsWith(prefix))) {
    return matchesSegments(
      pathSegments,
      segmentsOf({ path: resolve(cwd, pattern), separator: sep }),
    );
  }

  const patternSegments = segmentsOf({ path: pattern, separator: "/" });
  return pathSegments.some((_, index) =>
    matchesSegments(pathSegments.slice(index), patternSegments),
  );
};
