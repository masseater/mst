import {
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  lstatSync,
  statSync,
  type Dirent,
  type Stats,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { attempt, partition, sortBy, uniqBy } from "es-toolkit";

import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import { readUnlessMissing } from "../path-failure.ts";
import { pathIsInside } from "../path-is-inside.ts";
import { toPosixPath } from "../posix-path.ts";
import { MANIFEST_FILE_NAME } from "./package-manifest.ts";

export type ScannedFile = {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly realPathIdentity: string;
  readonly size: number;
  readonly symbolicLinkTarget: string | null;
  readonly mtimeMs: number;
};

export type RepositoryFiles = {
  readonly cacheInputs: readonly ScannedFile[];
  readonly declarationSources: readonly ScannedFile[];
  readonly commentSources: readonly ScannedFile[];
  readonly manifests: readonly ScannedFile[];
  readonly problems: readonly RepositoryFileProblem[];
};

export type RepositoryFileProblem = {
  readonly kind: "unsafe-symbolic-link";
  readonly line: 1;
  readonly filePath: string;
};

type ScannedFiles = {
  readonly files: readonly ScannedFile[];
  readonly problems: readonly RepositoryFileProblem[];
};

const UNSCANNED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  ".local-agents",
  "coverage",
  "dist",
  "dist-ssr",
  "node_modules",
]);

const UNCACHED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  ".local-agents",
  "coverage",
  "node_modules",
]);

const UNRESOLVED_MODULE_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".git",
  ".local-agents",
  "node_modules",
]);

const SCRIPT_FILE_NAME_PATTERN = /\.[cm]?[jt]sx?$/u;

const DEPENDENCY_INPUT_FILE_NAMES: ReadonlySet<string> = new Set([
  ".npmrc",
  ".yarnrc",
  ".yarnrc.yml",
  "bun.lock",
  "bun.lockb",
  "deno.lock",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
]);

const DECLARATION_SOURCE_NAME_PATTERN = /\.[cm]?tsx?$/u;

const TYPE_DECLARATION_FILE_NAME_PATTERN = /\.d\.[cm]?ts$/u;

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

const scannedFileAt = (input: {
  readonly absolutePath: string;
  readonly realRepositoryRoot: string;
  readonly repositoryRoot: string;
}): ScannedFile | null => {
  const { absolutePath, realRepositoryRoot, repositoryRoot } = input;
  const stats = statOf(absolutePath);
  if (stats === null) return null;
  const realPath = readUnlessMissing(() => realpathSync.native(absolutePath));
  if (realPath === null) return null;
  const symbolicLinkTarget = readUnlessMissing(() =>
    lstatSync(absolutePath).isSymbolicLink() ? readlinkSync(absolutePath) : null,
  );
  return {
    absolutePath,
    relativePath: toPosixPath(relative(repositoryRoot, absolutePath)),
    realPathIdentity: toPosixPath(relative(realRepositoryRoot, realPath)),
    size: stats.size,
    symbolicLinkTarget,
    mtimeMs: stats.mtimeMs,
  };
};

const isScannedName = (name: string): boolean =>
  SCRIPT_FILE_NAME_PATTERN.test(name) ||
  name.endsWith(".json") ||
  DEPENDENCY_INPUT_FILE_NAMES.has(name);

const EMPTY_SCANNED_FILES: ScannedFiles = { files: [], problems: [] };

const unsafeLinkAt = (repositoryRoot: string, absolutePath: string): ScannedFiles => ({
  files: [],
  problems: [
    {
      kind: "unsafe-symbolic-link",
      line: 1,
      filePath: toPosixPath(relative(repositoryRoot, absolutePath)),
    },
  ],
});

const resolvedSymbolicTarget = (input: ScanDirectoryInput, absolutePath: string): string | null => {
  const [failure, realTarget] = attempt(() => realpathSync.native(absolutePath));
  if (failure !== null || realTarget === null) return null;
  if (!pathIsInside(input.realRepositoryRoot, realTarget)) return null;
  return input.ancestry.has(realTarget) ? null : realTarget;
};

type ScanDirectoryInput = {
  readonly ancestry: ReadonlySet<string>;
  readonly directory: string;
  readonly includesFileName: (name: string) => boolean;
  readonly ignoredDirectoryNames: ReadonlySet<string>;
  readonly realRepositoryRoot: string;
  readonly repositoryRoot: string;
};

const scannedSymbolicLink = (input: ScanDirectoryInput, directoryEntry: Dirent): ScannedFiles => {
  const absolutePath = join(input.directory, directoryEntry.name);
  const realTarget = resolvedSymbolicTarget(input, absolutePath);
  if (realTarget === null) return unsafeLinkAt(input.repositoryRoot, absolutePath);
  const target = statOf(absolutePath);
  if (target?.isDirectory() === true) {
    return scannedFilesUnder({
      ...input,
      ancestry: new Set([...input.ancestry, realTarget]),
      directory: absolutePath,
    });
  }
  if (target?.isFile() !== true || !input.includesFileName(directoryEntry.name)) {
    return EMPTY_SCANNED_FILES;
  }
  const scanned = scannedFileAt({
    absolutePath,
    realRepositoryRoot: input.realRepositoryRoot,
    repositoryRoot: input.repositoryRoot,
  });
  return scanned === null
    ? unsafeLinkAt(input.repositoryRoot, absolutePath)
    : { files: [scanned], problems: [] };
};

const scannedDirectoryEntry = (input: ScanDirectoryInput, directoryEntry: Dirent): ScannedFiles => {
  const absolutePath = join(input.directory, directoryEntry.name);
  if (
    input.ignoredDirectoryNames.has(directoryEntry.name) &&
    (directoryEntry.isDirectory() || directoryEntry.isSymbolicLink())
  ) {
    return EMPTY_SCANNED_FILES;
  }
  if (directoryEntry.isSymbolicLink()) return scannedSymbolicLink(input, directoryEntry);
  if (directoryEntry.isDirectory()) {
    return input.ignoredDirectoryNames.has(directoryEntry.name)
      ? EMPTY_SCANNED_FILES
      : scannedFilesUnder({ ...input, directory: absolutePath });
  }
  if (!directoryEntry.isFile() || !input.includesFileName(directoryEntry.name)) {
    return EMPTY_SCANNED_FILES;
  }
  const scanned = scannedFileAt({
    absolutePath,
    realRepositoryRoot: input.realRepositoryRoot,
    repositoryRoot: input.repositoryRoot,
  });
  return scanned === null ? EMPTY_SCANNED_FILES : { files: [scanned], problems: [] };
};

const scannedFilesUnder = ({
  repositoryRoot,
  directory,
  includesFileName,
  ignoredDirectoryNames,
  ancestry,
  realRepositoryRoot,
}: ScanDirectoryInput): ScannedFiles => {
  const scanned = readdirSync(directory, { withFileTypes: true }).map((directoryEntry) =>
    scannedDirectoryEntry(
      {
        ancestry,
        directory,
        includesFileName,
        ignoredDirectoryNames,
        realRepositoryRoot,
        repositoryRoot,
      },
      directoryEntry,
    ),
  );
  return {
    files: scanned.flatMap((result) => result.files),
    problems: scanned.flatMap((result) => result.problems),
  };
};

const isManifest = (file: ScannedFile): boolean =>
  basename(file.absolutePath) === MANIFEST_FILE_NAME;

const isCommentSource = (file: ScannedFile): boolean =>
  SCRIPT_FILE_NAME_PATTERN.test(basename(file.absolutePath));

const isScannedSourcePath = (file: ScannedFile): boolean =>
  !file.relativePath
    .split("/")
    .slice(0, -1)
    .some((segment) => UNSCANNED_DIRECTORY_NAMES.has(segment));

const isDeclarationSource = (file: ScannedFile): boolean => {
  const name = basename(file.absolutePath);
  return (
    DECLARATION_SOURCE_NAME_PATTERN.test(name) &&
    !TYPE_DECLARATION_FILE_NAME_PATTERN.test(name) &&
    !isOutOfScopeSource(file.relativePath) &&
    !isOutOfScopeSource(file.realPathIdentity)
  );
};

const uniquePhysicalFiles = (files: readonly ScannedFile[]): readonly ScannedFile[] =>
  uniqBy(
    sortBy(files, [(file) => (file.symbolicLinkTarget === null ? 0 : 1), "relativePath"]),
    (file) => file.realPathIdentity,
  );

const NO_REPOSITORY_FILES: RepositoryFiles = {
  cacheInputs: [],
  declarationSources: [],
  commentSources: [],
  manifests: [],
  problems: [],
};

export const listRepositoryFiles = (repositoryRoot: string): RepositoryFiles => {
  if (!isDirectory(repositoryRoot)) return NO_REPOSITORY_FILES;

  const realRoot = realpathSync.native(repositoryRoot);
  const scannedRepository = scannedFilesUnder({
    repositoryRoot,
    realRepositoryRoot: realRoot,
    directory: repositoryRoot,
    includesFileName: isScannedName,
    ignoredDirectoryNames: UNCACHED_DIRECTORY_NAMES,
    ancestry: new Set([realRoot]),
  });
  const cacheInputs = sortBy(scannedRepository.files, ["relativePath"]);
  const scanned = cacheInputs.filter(isScannedSourcePath);
  const [manifests, otherScannedFiles] = partition(scanned, isManifest);
  const commentSources = uniquePhysicalFiles(otherScannedFiles.filter(isCommentSource));

  return {
    cacheInputs,
    declarationSources: commentSources.filter(isDeclarationSource),
    commentSources,
    manifests,
    problems: sortBy(scannedRepository.problems, ["filePath"]),
  };
};

export const listRepositoryModuleFiles = (repositoryRoot: string): readonly ScannedFile[] => {
  if (!isDirectory(repositoryRoot)) return [];
  const realRoot = realpathSync.native(repositoryRoot);
  return scannedFilesUnder({
    repositoryRoot,
    realRepositoryRoot: realRoot,
    directory: repositoryRoot,
    includesFileName: () => true,
    ignoredDirectoryNames: UNRESOLVED_MODULE_DIRECTORY_NAMES,
    ancestry: new Set([realRoot]),
  }).files;
};
