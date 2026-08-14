import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { readUnlessMissing } from "@mst/repository-checks";
import { memoize } from "es-toolkit";

import { toPosixPath } from "../posix-path.ts";

import type { Context } from "@oxlint/plugins";

export const UNSCANNED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  "coverage",
  "dist",
  "dist-ssr",
  "node_modules",
]);

export const unscannedDirectoryNamesFrom = (
  ruleOptions: Context["options"],
): ReadonlySet<string> => {
  const declared = ((ruleOptions[0] ?? {}) as { readonly unscannedDirectories?: readonly string[] })
    .unscannedDirectories;
  return declared === undefined ? UNSCANNED_DIRECTORY_NAMES : new Set(declared);
};

export type Worktree = {
  readonly root: string;
  readonly unscannedDirectoryNames: ReadonlySet<string>;
};

const filePathsUnder = (worktree: Worktree, directory: string): readonly string[] => {
  const directoryChildren = readUnlessMissing(() =>
    readdirSync(directory, { withFileTypes: true }),
  );
  if (directoryChildren === null) return [];

  return directoryChildren.flatMap((directoryChild) => {
    const path = join(directory, directoryChild.name);
    if (directoryChild.isDirectory()) {
      return worktree.unscannedDirectoryNames.has(directoryChild.name)
        ? []
        : filePathsUnder(worktree, path);
    }
    return directoryChild.isFile() ? [toPosixPath(relative(worktree.root, path))] : [];
  });
};

const worktreeKeyOf = (worktree: Worktree): string =>
  [worktree.root, ...[...worktree.unscannedDirectoryNames].toSorted()].join("\n");

const scannedFilePathsUnder = memoize(
  (worktree: Worktree): readonly string[] => filePathsUnder(worktree, worktree.root).toSorted(),
  { getCacheKey: worktreeKeyOf },
);

export const worktreeFilePathsUnder = (asked: Worktree): readonly string[] =>
  scannedFilePathsUnder({
    root: resolve(asked.root),
    unscannedDirectoryNames: asked.unscannedDirectoryNames,
  });
