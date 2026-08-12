import { lstatSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { attempt } from "es-toolkit";

import { gitOutput } from "./git-output.ts";
import { pathIsInside } from "./path-is-inside.ts";

const realPathOf = (path: string): string => {
  const [failure, realPath] = attempt(() => realpathSync.native(path));
  return failure === null && realPath !== null ? realPath : path;
};

const repositoryPathOf = (input: {
  readonly repositoryRoot: string;
  readonly realRepositoryRoot: string;
  readonly source: string;
}): string | null => {
  if (pathIsInside(input.repositoryRoot, input.source)) {
    return relative(input.repositoryRoot, input.source);
  }
  const realSource = realPathOf(input.source);
  return pathIsInside(input.realRepositoryRoot, realSource)
    ? relative(input.realRepositoryRoot, realSource)
    : null;
};

const firstSymbolicPath = (repositoryRoot: string, repositoryPath: string): string | null => {
  const segments = repositoryPath.split(sep);
  for (const index of segments.keys()) {
    const candidate = join(repositoryRoot, ...segments.slice(0, index + 1));
    const [failure, stats] = attempt(() => lstatSync(candidate));
    if (failure === null && stats?.isSymbolicLink() === true)
      return relative(repositoryRoot, candidate);
  }
  return null;
};

const ignoredRepositoryPaths = (repositoryRoot: string): ReadonlySet<string> => {
  const ignoredPathOutput = gitOutput(
    ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"],
    { cwd: repositoryRoot, env: process.env },
  );
  return ignoredPathOutput !== null
    ? new Set(ignoredPathOutput.split("\0").filter((path) => path !== ""))
    : new Set();
};

const pathIsIgnored = (repositoryPath: string, ignoredPaths: ReadonlySet<string>): boolean =>
  ignoredPaths.has(repositoryPath) ||
  [...ignoredPaths].some(
    (ignoredPath) => ignoredPath.endsWith("/") && repositoryPath.startsWith(ignoredPath),
  );

export type GitSourceScope = {
  readonly isIgnored: (sourcePath: string) => boolean;
};

export const readGitSourceScope = (repositoryRoot: string): GitSourceScope => {
  const root = resolve(repositoryRoot);
  const realRoot = realPathOf(root);
  const ignoredPaths = ignoredRepositoryPaths(root);
  return {
    isIgnored(sourcePath) {
      const source = resolve(root, sourcePath);
      const repositoryPath = repositoryPathOf({
        repositoryRoot: root,
        realRepositoryRoot: realRoot,
        source,
      });
      if (repositoryPath === null || repositoryPath === "") return false;
      return pathIsIgnored(firstSymbolicPath(root, repositoryPath) ?? repositoryPath, ignoredPaths);
    },
  };
};
