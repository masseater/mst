import { relative, sep } from "node:path";

import { uniq } from "es-toolkit";

import { matchesGlobSegment } from "./glob-segment.ts";

export type SymbolPrefixedSegment = {
  readonly segment: string;
  readonly path: string;
};

const startsWithAlphanumeric = (segment: string): boolean => /^[a-zA-Z0-9]/u.test(segment);

const repositoryRelativePathOf = ({
  cwd,
  filename,
}: {
  readonly cwd: string;
  readonly filename: string;
}): string | null => {
  const relativePath = relative(cwd, filename);
  if (relativePath === "") return null;
  return relativePath.split(sep).includes("..") ? null : relativePath;
};

export const symbolPrefixedSegmentsOf = ({
  location,
  allowedNames,
}: {
  readonly location: { readonly cwd: string; readonly filename: string };
  readonly allowedNames: readonly string[];
}): readonly SymbolPrefixedSegment[] => {
  const path = repositoryRelativePathOf(location);
  if (path === null) return [];
  return uniq(
    path
      .split(sep)
      .filter((segment) => segment !== "" && !startsWithAlphanumeric(segment))
      .filter(
        (segment) => !allowedNames.some((pattern) => matchesGlobSegment({ segment, pattern })),
      ),
  ).map((segment) => ({ segment, path }));
};
