import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

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

const filePathsByWorktree = new Map<string, readonly string[]>();

const worktreeKeyOf = (worktree: Worktree): string =>
  [worktree.root, ...[...worktree.unscannedDirectoryNames].toSorted()].join("\n");

export const worktreeFilePathsUnder = (asked: Worktree): readonly string[] => {
  const worktree: Worktree = {
    root: resolve(asked.root),
    unscannedDirectoryNames: asked.unscannedDirectoryNames,
  };
  const key = worktreeKeyOf(worktree);
  const memoized = filePathsByWorktree.get(key);
  if (memoized !== undefined) return memoized;

  const scanned = filePathsUnder(worktree, worktree.root).toSorted();
  filePathsByWorktree.set(key, scanned);
  return scanned;
};
