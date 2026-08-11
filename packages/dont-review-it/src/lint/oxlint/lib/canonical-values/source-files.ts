import { readdirSync, readFileSync, statSync, type Stats } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { readUnlessMissing } from "@mst/utils";
import { sortBy } from "es-toolkit";

import { toPosixPath } from "../posix-path.ts";
import { UNSCANNED_DIRECTORY_NAMES } from "../repository-scan/worktree-files.ts";
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
  readonly styleSheets: readonly ScannedFile[];
  readonly markupSources: readonly ScannedFile[];
  readonly manifests: readonly ScannedFile[];
};

const SCRIPT_FILE_NAME_PATTERN = /\.[cm]?[jt]sx?$/u;

const DECLARATION_SOURCE_NAME_PATTERN = /\.[cm]?tsx?$/u;

const TEST_FILE_NAME_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

const STYLE_SHEET_EXTENSION = ".css";

const MARKUP_SOURCE_NAME_PATTERN = /\.(?:html|svg)$/u;

const statOf = (path: string): Stats | null => readUnlessMissing(() => statSync(path));

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
  readUnlessMissing(() => readFileSync(path, "utf8"));

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
  name === MANIFEST_FILE_NAME ||
  SCRIPT_FILE_NAME_PATTERN.test(name) ||
  name.endsWith(STYLE_SHEET_EXTENSION) ||
  MARKUP_SOURCE_NAME_PATTERN.test(name);

const scannedFilesUnder = (repositoryRoot: string, directory: string): readonly ScannedFile[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((directoryEntry) => {
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

const isScriptSource = (file: ScannedFile): boolean =>
  SCRIPT_FILE_NAME_PATTERN.test(basename(file.absolutePath));

const isStyleSheet = (file: ScannedFile): boolean =>
  basename(file.absolutePath).endsWith(STYLE_SHEET_EXTENSION);

const isMarkupSource = (file: ScannedFile): boolean =>
  MARKUP_SOURCE_NAME_PATTERN.test(basename(file.absolutePath));

const isDeclarationSource = (file: ScannedFile): boolean => {
  const name = basename(file.absolutePath);
  return DECLARATION_SOURCE_NAME_PATTERN.test(name) && !TEST_FILE_NAME_PATTERN.test(name);
};

const NO_REPOSITORY_FILES: RepositoryFiles = {
  declarationSources: [],
  commentSources: [],
  styleSheets: [],
  markupSources: [],
  manifests: [],
};

export const listRepositoryFiles = (repositoryRoot: string): RepositoryFiles => {
  if (!isDirectory(repositoryRoot)) return NO_REPOSITORY_FILES;

  const scanned = sortBy(scannedFilesUnder(repositoryRoot, repositoryRoot), ["relativePath"]);
  const commentSources = scanned.filter(isScriptSource);

  return {
    declarationSources: commentSources.filter(isDeclarationSource),
    commentSources,
    styleSheets: scanned.filter(isStyleSheet),
    markupSources: scanned.filter(isMarkupSource),
    manifests: scanned.filter(isManifest),
  };
};
