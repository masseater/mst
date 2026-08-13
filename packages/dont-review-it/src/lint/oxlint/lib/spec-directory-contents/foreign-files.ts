import { dirname, join } from "node:path";

import { groupBy, memoize } from "es-toolkit";

import { nearestPackageDirectory } from "../canonical-values/source-files.ts";
import { spelledNames } from "../declared-coverage/coverage-declarations.ts";
import {
  REPOSITORY_ROOT_WORKSPACE,
  workspaceDirectoryOf,
} from "../dependency-catalog/shared-dependency-index.ts";
import { worktreeFilePathsUnder } from "../repository-scan/worktree-files.ts";
import { assetsStemOf } from "../spec-syntax/assets-files.ts";
import { specDirectoryOf } from "../spec-syntax/spec-directories.ts";
import { isSpecFile } from "../spec-syntax/spec-files.ts";

export const FOREIGN_FILE_IN_SPEC_DIRECTORY_MESSAGE_ID = "foreignFileInSpecDirectory";

type SpecDirectoryConvention = {
  readonly specDirectoryNames: ReadonlySet<string>;
  readonly specFileSuffixes: readonly string[];
  readonly assetsNameMarkers: ReadonlySet<string>;
};

export type SpecDirectoryScan = {
  readonly repositoryRoot: string;
  readonly convention: SpecDirectoryConvention;
  readonly unscannedDirectoryNames: ReadonlySet<string>;
};

type ForeignFile = {
  readonly workspace: string;
  readonly messageId: string;
  readonly data: {
    readonly specDirectory: string;
    readonly foreignPath: string;
    readonly specNames: string;
    readonly assetsNames: string;
  };
};

export const holdingWorkspaceOf = ({
  repositoryRoot,
  relativePath,
}: {
  readonly repositoryRoot: string;
  readonly relativePath: string;
}): string => {
  const packageDirectory = nearestPackageDirectory(
    dirname(join(repositoryRoot, relativePath)),
    repositoryRoot,
  );
  return packageDirectory === null
    ? REPOSITORY_ROOT_WORKSPACE
    : workspaceDirectoryOf({ repositoryRoot, packageDirectory });
};

const holdsSpecOrAssets = (relativePath: string, convention: SpecDirectoryConvention): boolean =>
  isSpecFile(relativePath, convention.specFileSuffixes) ||
  assetsStemOf(relativePath, convention.assetsNameMarkers) !== null;

const foreignFileAt = ({
  scan,
  relativePath,
  spelling,
}: {
  readonly scan: SpecDirectoryScan;
  readonly relativePath: string;
  readonly spelling: { readonly specNames: string; readonly assetsNames: string };
}): ForeignFile | null => {
  const specDirectory = specDirectoryOf({
    relativePath,
    names: scan.convention.specDirectoryNames,
  });
  if (specDirectory === null || holdsSpecOrAssets(relativePath, scan.convention)) return null;

  return {
    workspace: holdingWorkspaceOf({ repositoryRoot: scan.repositoryRoot, relativePath }),
    messageId: FOREIGN_FILE_IN_SPEC_DIRECTORY_MESSAGE_ID,
    data: { specDirectory, foreignPath: relativePath, ...spelling },
  };
};

const readScan = (scan: SpecDirectoryScan): ReadonlyMap<string, readonly ForeignFile[]> => {
  const spelling = {
    specNames: spelledNames(scan.convention.specFileSuffixes.map((suffix) => `*${suffix}`)),
    assetsNames: spelledNames(
      [...scan.convention.assetsNameMarkers].map((marker) => `*.${marker}.*`),
    ),
  };
  const found = worktreeFilePathsUnder({
    root: scan.repositoryRoot,
    unscannedDirectoryNames: scan.unscannedDirectoryNames,
  })
    .map((relativePath) => foreignFileAt({ scan, relativePath, spelling }))
    .filter((foreign) => foreign !== null);

  return new Map(Object.entries(groupBy(found, (foreign) => foreign.workspace)));
};

const keyOf = (scan: SpecDirectoryScan): string =>
  JSON.stringify([
    scan.repositoryRoot,
    [...scan.convention.specDirectoryNames].toSorted(),
    scan.convention.specFileSuffixes,
    [...scan.convention.assetsNameMarkers].toSorted(),
    [...scan.unscannedDirectoryNames].toSorted(),
  ]);

const scannedForeignFiles = memoize(readScan, { getCacheKey: keyOf });

export const foreignFilesIn = (
  scan: SpecDirectoryScan,
): ReadonlyMap<string, readonly ForeignFile[]> => scannedForeignFiles(scan);
