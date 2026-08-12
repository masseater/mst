import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { readUnlessMissing } from "../path-failure.ts";
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

export type Worktree = {
  readonly root: string;
  readonly unscannedDirectoryNames: ReadonlySet<string>;
};

export const unscannedDirectoryNamesFrom = (options: Context["options"]): ReadonlySet<string> => {
  const declared = ((options[0] ?? {}) as { readonly unscannedDirectories?: readonly string[] })
    .unscannedDirectories;
  return declared === undefined ? UNSCANNED_DIRECTORY_NAMES : new Set(declared);
};

const filePathsUnder = (worktree: Worktree, directory: string): readonly string[] => {
  const entries = readUnlessMissing(() => readdirSync(directory, { withFileTypes: true }));
  if (entries === null) return [];

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return worktree.unscannedDirectoryNames.has(entry.name) ? [] : filePathsUnder(worktree, path);
    }
    return entry.isFile() ? [toPosixPath(relative(worktree.root, path))] : [];
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
