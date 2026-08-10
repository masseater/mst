import { readdirSync, readFileSync, statSync, type Dirent, type Stats } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { attempt, partition, sortBy } from "es-toolkit";

import { toPosixPath } from "../posix-path.ts";
import { MANIFEST_FILE_NAME } from "./package-manifest.ts";

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

const statOf = (path: string): Stats | null => attempt(() => statSync(path))[1];

export const isFile = (path: string): boolean => statOf(path)?.isFile() === true;

export const isDirectory = (path: string): boolean => statOf(path)?.isDirectory() === true;

export const nearestPackageDirectory = (
  fileDirectory: string,
  repositoryRoot: string,
): string | null => {
  if (isFile(join(fileDirectory, MANIFEST_FILE_NAME))) return fileDirectory;
  if (fileDirectory === repositoryRoot) return null;

  const parent = dirname(fileDirectory);
  return parent === fileDirectory ? null : nearestPackageDirectory(parent, repositoryRoot);
};

export const readTextFile = (path: string): string | null =>
  attempt(() => readFileSync(path, "utf8"))[1];

const directoryEntriesOf = (directory: string): readonly Dirent[] =>
  attempt(() => readdirSync(directory, { withFileTypes: true }))[1] ?? [];

const scannedFileAt = (repositoryRoot: string, absolutePath: string): ScannedFile | null => {
  const stats = statOf(absolutePath);
  if (stats === null) return null;
  return {
    absolutePath,
    relativePath: toPosixPath(relative(repositoryRoot, absolutePath)),
    size: stats.size,
    mtimeMs: stats.mtimeMs,
  };
};

const isScannedName = (name: string): boolean =>
  name === MANIFEST_FILE_NAME || SCRIPT_FILE_NAME_PATTERN.test(name);

const scannedFilesUnder = (repositoryRoot: string, directory: string): readonly ScannedFile[] =>
  directoryEntriesOf(directory).flatMap((directoryEntry) => {
    const absolutePath = join(directory, directoryEntry.name);
    if (directoryEntry.isDirectory()) {
      return UNSCANNED_DIRECTORY_NAMES.has(directoryEntry.name)
        ? []
        : scannedFilesUnder(repositoryRoot, absolutePath);
    }
    if (!directoryEntry.isFile()) return [];
    if (!isScannedName(directoryEntry.name)) return [];
    const scanned = scannedFileAt(repositoryRoot, absolutePath);
    return scanned === null ? [] : [scanned];
  });

const isManifest = (file: ScannedFile): boolean =>
  basename(file.absolutePath) === MANIFEST_FILE_NAME;

const isDeclarationSource = (file: ScannedFile): boolean => {
  const name = basename(file.absolutePath);
  return DECLARATION_SOURCE_NAME_PATTERN.test(name) && !TEST_FILE_NAME_PATTERN.test(name);
};

export const listRepositoryFiles = (repositoryRoot: string): RepositoryFiles => {
  const scanned = sortBy(scannedFilesUnder(repositoryRoot, repositoryRoot), ["relativePath"]);
  const [manifests, commentSources] = partition(scanned, isManifest);

  return {
    declarationSources: commentSources.filter(isDeclarationSource),
    commentSources,
    manifests,
  };
};
