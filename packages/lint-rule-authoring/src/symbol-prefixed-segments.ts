import { relative, sep } from "node:path";

import { matchesGlobSegment } from "./glob-segment.ts";

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
}): ReadonlyMap<string, string> => {
  const path = repositoryRelativePathOf(location);
  if (path === null) return new Map();
  return new Map(
    path
      .split(sep)
      .filter((segment) => segment !== "" && !startsWithAlphanumeric(segment))
      .filter(
        (segment) => !allowedNames.some((pattern) => matchesGlobSegment({ segment, pattern })),
      )
      .map((segment): readonly [string, string] => [segment, path]),
  );
};
