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

import { readUnlessMissing } from "@mst/repository-checks";
import { attempt, partition, sortBy, uniqBy } from "es-toolkit";

import { readGitSourceScope, type GitSourceScope } from "../git-ignored-source.ts";
import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import { pathIsInside } from "../path-is-inside.ts";
import { toPosixPath } from "../posix-path.ts";
import { MANIFEST_FILE_NAME } from "./package-manifest.ts";

const statOf = (path: string): Stats | null => readUnlessMissing(() => statSync(path));

export const isFile = (path: string): boolean => statOf(path)?.isFile() === true;

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

const STYLE_SHEET_EXTENSION = ".css";

const MARKUP_SOURCE_NAME_PATTERN = /\.(?:html|svg)$/u;

const isScannedName = (fileName: string): boolean =>
  SCRIPT_FILE_NAME_PATTERN.test(fileName) ||
  fileName.endsWith(STYLE_SHEET_EXTENSION) ||
  MARKUP_SOURCE_NAME_PATTERN.test(fileName) ||
  fileName.endsWith(".json") ||
  DEPENDENCY_INPUT_FILE_NAMES.has(fileName);

export type RepositoryFileProblem = {
  readonly kind: "unsafe-symbolic-link";
  readonly line: 1;
  readonly filePath: string;
};

export type ScannedFile = {
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly realPathIdentity: string;
  readonly size: number;
  readonly symbolicLinkTarget: string | null;
  readonly mtimeMs: number;
};

type ScannedFiles = {
  readonly files: readonly ScannedFile[];
  readonly problems: readonly RepositoryFileProblem[];
};

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

type ScanDirectoryInput = {
  readonly ancestry: ReadonlySet<string>;
  readonly directory: string;
  readonly includesFileName: (name: string) => boolean;
  readonly ignoredDirectoryNames: ReadonlySet<string>;
  readonly sourceScope: GitSourceScope;
  readonly realRepositoryRoot: string;
  readonly repositoryRoot: string;
};

const resolvedSymbolicTarget = (input: ScanDirectoryInput, absolutePath: string): string | null => {
  const [failure, resolvedTargetPath] = attempt(() => realpathSync.native(absolutePath));
  if (failure !== null || resolvedTargetPath === null) return null;
  if (!pathIsInside(input.realRepositoryRoot, resolvedTargetPath)) return null;
  return input.ancestry.has(resolvedTargetPath) ? null : resolvedTargetPath;
};

const scannedFileAt = (input: {
  readonly absolutePath: string;
  readonly realRepositoryRoot: string;
  readonly repositoryRoot: string;
}): ScannedFile => {
  const { absolutePath, realRepositoryRoot, repositoryRoot } = input;
  const stats = statSync(absolutePath);
  const realPath = realpathSync.native(absolutePath);
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

const EMPTY_SCANNED_FILES: ScannedFiles = { files: [], problems: [] };

const scannedSymbolicFile = (
  input: ScanDirectoryInput,
  candidate: {
    readonly absolutePath: string;
    readonly directoryEntry: Dirent;
    readonly isFile: boolean;
  },
): ScannedFiles => {
  if (!candidate.isFile || !input.includesFileName(candidate.directoryEntry.name)) {
    return EMPTY_SCANNED_FILES;
  }
  const scanned = scannedFileAt({
    absolutePath: candidate.absolutePath,
    realRepositoryRoot: input.realRepositoryRoot,
    repositoryRoot: input.repositoryRoot,
  });
  return { files: [scanned], problems: [] };
};

const scannedSymbolicLink = (input: ScanDirectoryInput, directoryEntry: Dirent): ScannedFiles => {
  const absolutePath = join(input.directory, directoryEntry.name);
  if (input.sourceScope.isIgnored(absolutePath)) return EMPTY_SCANNED_FILES;
  const resolvedTargetPath = resolvedSymbolicTarget(input, absolutePath);
  if (resolvedTargetPath === null) return unsafeLinkAt(input.repositoryRoot, absolutePath);
  const targetStats = statOf(absolutePath);
  if (targetStats?.isDirectory() === true) {
    return scannedFilesUnder({
      ...input,
      ancestry: new Set([...input.ancestry, resolvedTargetPath]),
      directory: absolutePath,
    });
  }
  return scannedSymbolicFile(input, {
    absolutePath,
    directoryEntry,
    isFile: targetStats?.isFile() === true,
  });
};

const scannedRegularFile = (input: ScanDirectoryInput, absolutePath: string): ScannedFiles => {
  const scanned = scannedFileAt({
    absolutePath,
    realRepositoryRoot: input.realRepositoryRoot,
    repositoryRoot: input.repositoryRoot,
  });
  return { files: [scanned], problems: [] };
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
    return scannedFilesUnder({ ...input, directory: absolutePath });
  }
  if (!directoryEntry.isFile() || !input.includesFileName(directoryEntry.name)) {
    return EMPTY_SCANNED_FILES;
  }
  return scannedRegularFile(input, absolutePath);
};

const scannedFilesUnder = ({
  repositoryRoot,
  directory,
  includesFileName,
  ignoredDirectoryNames,
  ancestry,
  realRepositoryRoot,
  sourceScope,
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
        sourceScope,
      },
      directoryEntry,
    ),
  );
  return {
    files: scanned.flatMap((scan) => scan.files),
    problems: scanned.flatMap((scan) => scan.problems),
  };
};

const isManifest = (file: ScannedFile): boolean =>
  basename(file.absolutePath) === MANIFEST_FILE_NAME;

const isCommentSource = (file: ScannedFile): boolean =>
  SCRIPT_FILE_NAME_PATTERN.test(basename(file.absolutePath));

const isStyleSheet = (file: ScannedFile): boolean =>
  basename(file.absolutePath).endsWith(STYLE_SHEET_EXTENSION);

const isMarkupSource = (file: ScannedFile): boolean =>
  MARKUP_SOURCE_NAME_PATTERN.test(basename(file.absolutePath));

const UNSCANNED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  ".local-agents",
  "coverage",
  "dist",
  "dist-ssr",
  "node_modules",
]);

const isScannedSourcePath = (file: ScannedFile): boolean =>
  !file.relativePath
    .split("/")
    .slice(0, -1)
    .some((segment) => UNSCANNED_DIRECTORY_NAMES.has(segment));

const DECLARATION_SOURCE_NAME_PATTERN = /\.[cm]?tsx?$/u;

const TYPE_DECLARATION_FILE_NAME_PATTERN = /\.d\.[cm]?ts$/u;

const isDeclarationSource = (file: ScannedFile): boolean => {
  const fileName = basename(file.absolutePath);
  return (
    DECLARATION_SOURCE_NAME_PATTERN.test(fileName) &&
    !TYPE_DECLARATION_FILE_NAME_PATTERN.test(fileName) &&
    !isOutOfScopeSource(file.relativePath) &&
    !isOutOfScopeSource(file.realPathIdentity)
  );
};

const uniquePhysicalFiles = (files: readonly ScannedFile[]): readonly ScannedFile[] =>
  uniqBy(
    sortBy(files, [(file) => (file.symbolicLinkTarget === null ? 0 : 1), "relativePath"]),
    (file) => file.realPathIdentity,
  );

export type RepositoryFiles = {
  readonly cacheInputs: readonly ScannedFile[];
  readonly declarationSources: readonly ScannedFile[];
  readonly commentSources: readonly ScannedFile[];
  readonly styleSheets: readonly ScannedFile[];
  readonly markupSources: readonly ScannedFile[];
  readonly manifests: readonly ScannedFile[];
  readonly problems: readonly RepositoryFileProblem[];
};

const NO_REPOSITORY_FILES: RepositoryFiles = {
  cacheInputs: [],
  declarationSources: [],
  commentSources: [],
  styleSheets: [],
  markupSources: [],
  manifests: [],
  problems: [],
};

const UNCACHED_DIRECTORY_NAMES: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  ".local-agents",
  "coverage",
  "node_modules",
]);

export const isDirectory = (path: string): boolean => statOf(path)?.isDirectory() === true;

export const listRepositoryFiles = (
  repositoryRoot: string,
  sourceScope: GitSourceScope = readGitSourceScope(repositoryRoot),
): RepositoryFiles => {
  if (!isDirectory(repositoryRoot)) return NO_REPOSITORY_FILES;

  const realRoot = realpathSync.native(repositoryRoot);
  const scannedRepository = scannedFilesUnder({
    repositoryRoot,
    realRepositoryRoot: realRoot,
    directory: repositoryRoot,
    includesFileName: isScannedName,
    ignoredDirectoryNames: UNCACHED_DIRECTORY_NAMES,
    sourceScope,
    ancestry: new Set([realRoot]),
  });
  const cacheInputs = sortBy(
    scannedRepository.files.filter((file) => !sourceScope.isIgnored(file.absolutePath)),
    ["relativePath"],
  );
  const scanned = cacheInputs.filter(isScannedSourcePath);
  const [manifests, otherScannedFiles] = partition(scanned, isManifest);
  const commentSources = uniquePhysicalFiles(otherScannedFiles.filter(isCommentSource));

  return {
    cacheInputs,
    declarationSources: commentSources.filter(isDeclarationSource),
    commentSources,
    styleSheets: scanned.filter(isStyleSheet),
    markupSources: scanned.filter(isMarkupSource),
    manifests,
    problems: sortBy(scannedRepository.problems, ["filePath"]),
  };
};
