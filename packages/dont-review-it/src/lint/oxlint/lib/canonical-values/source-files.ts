import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";

import type { Stats } from "node:fs";

export type ScannedFile = {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly size: number;
  readonly mtimeMs: number;
};

export type RepositoryFiles = {
  readonly declarationSources: readonly ScannedFile[];
  readonly commentSources: readonly ScannedFile[];
  readonly manifests: readonly ScannedFile[];
};

export const MANIFEST_FILE_NAME = "package.json";

const UNSCANNED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  "coverage",
  "dist",
  "dist-ssr",
  "node_modules",
]);

const SCRIPT_FILE_NAME_PATTERN = /\.[cm]?[jt]sx?$/u;

const DECLARATION_SOURCE_NAME_PATTERN = /\.[cm]?tsx?$/u;

const TEST_FILE_NAME_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

const statOf = (path: string): Stats | null => {
  try {
    return statSync(path);
  } catch {
    return null;
  }
};

export const isFile = (path: string): boolean => statOf(path)?.isFile() === true;

export const isDirectory = (path: string): boolean => statOf(path)?.isDirectory() === true;

export const nearestPackageDirectory = (
  fileDirectory: string,
  repositoryRoot: string,
): string | null => {
  let directory = fileDirectory;
  for (;;) {
    if (isFile(join(directory, MANIFEST_FILE_NAME))) return directory;
    if (directory === repositoryRoot) return null;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
};

export const readTextFile = (path: string): string | null => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const toPosixPath = (value: string): string => value.split(sep).join("/");

const byRelativePath = (left: ScannedFile, right: ScannedFile): number =>
  left.relativePath === right.relativePath ? 0 : left.relativePath < right.relativePath ? -1 : 1;

export const listRepositoryFiles = (repositoryRoot: string): RepositoryFiles => {
  const declarationSources: ScannedFile[] = [];
  const commentSources: ScannedFile[] = [];
  const manifests: ScannedFile[] = [];

  const walk = (directory: string): void => {
    let directoryEntries;
    try {
      directoryEntries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const directoryEntry of directoryEntries) {
      const absolutePath = join(directory, directoryEntry.name);
      if (directoryEntry.isDirectory()) {
        if (!UNSCANNED_DIRECTORY_NAMES.has(directoryEntry.name)) walk(absolutePath);
        continue;
      }
      if (!directoryEntry.isFile()) continue;
      const isManifest = directoryEntry.name === MANIFEST_FILE_NAME;
      if (!isManifest && !SCRIPT_FILE_NAME_PATTERN.test(directoryEntry.name)) continue;
      const stats = statOf(absolutePath);
      if (stats === null) continue;
      const scanned: ScannedFile = {
        absolutePath,
        relativePath: toPosixPath(relative(repositoryRoot, absolutePath)),
        size: stats.size,
        mtimeMs: stats.mtimeMs,
      };
      if (isManifest) {
        manifests.push(scanned);
        continue;
      }
      commentSources.push(scanned);
      if (
        DECLARATION_SOURCE_NAME_PATTERN.test(directoryEntry.name) &&
        !TEST_FILE_NAME_PATTERN.test(directoryEntry.name)
      ) {
        declarationSources.push(scanned);
      }
    }
  };

  walk(repositoryRoot);

  return {
    declarationSources: declarationSources.sort(byRelativePath),
    commentSources: commentSources.sort(byRelativePath),
    manifests: manifests.sort(byRelativePath),
  };
};
