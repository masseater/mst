import { readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { readUnlessMissing } from "@mst/repository-checks";

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

export const unscannedDirectoryNamesFrom = (
  ruleOptions: Context["options"],
): ReadonlySet<string> => {
  const declared = ((ruleOptions[0] ?? {}) as { readonly unscannedDirectories?: readonly string[] })
    .unscannedDirectories;
  return declared === undefined ? UNSCANNED_DIRECTORY_NAMES : new Set(declared);
};

const filePathsUnder = (worktree: Worktree, directory: string): readonly string[] => {
  const listedEntries = readUnlessMissing(() => readdirSync(directory, { withFileTypes: true }));
  if (listedEntries === null) return [];

  return listedEntries.flatMap((listed) => {
    const path = join(directory, listed.name);
    if (listed.isDirectory()) {
      return worktree.unscannedDirectoryNames.has(listed.name)
        ? []
        : filePathsUnder(worktree, path);
    }
    return listed.isFile() ? [toPosixPath(relative(worktree.root, path))] : [];
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
  const named = worktreeKeyOf(worktree);
  const memoized = filePathsByWorktree.get(named);
  if (memoized !== undefined) return memoized;

  const scanned = filePathsUnder(worktree, worktree.root).toSorted();
  filePathsByWorktree.set(named, scanned);
  return scanned;
};
