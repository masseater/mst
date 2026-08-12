import { dirname, relative, resolve } from "node:path";

import {
  listRepositoryFiles,
  nearestPackageDirectory,
  readTextFile,
  type ScannedFile,
} from "../canonical-values/source-files.ts";
import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import { toPosixPath } from "../posix-path.ts";
import {
  buildTypeAuthorityIndex,
  EMPTY_TYPE_AUTHORITY_INDEX,
  type ScannedTypeFile,
  type TypeAuthorityIndex,
} from "./authority-index.ts";
import { typeDeclarationsIn } from "./type-declarations.ts";

const workspacePathOf = ({
  repositoryRoot,
  absolutePath,
}: {
  readonly repositoryRoot: string;
  readonly absolutePath: string;
}): string => {
  const packageDirectory = nearestPackageDirectory(dirname(absolutePath), repositoryRoot);
  return packageDirectory === null ? "" : toPosixPath(relative(repositoryRoot, packageDirectory));
};

const scannedTypeFileAt = (repositoryRoot: string, file: ScannedFile): ScannedTypeFile | null => {
  const source = readTextFile(file.absolutePath);
  if (source === null) return null;

  const declarations = typeDeclarationsIn(source);
  return declarations.length === 0
    ? null
    : {
        relativePath: file.relativePath,
        workspacePath: workspacePathOf({ repositoryRoot, absolutePath: file.absolutePath }),
        declarations,
      };
};

const buildRepositoryTypeAuthorityIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): TypeAuthorityIndex => {
  const root = resolve(repositoryRoot);
  const { declarationSources } = listRepositoryFiles(root);
  const scanned = declarationSources.filter((file) => !isOutOfScopeSource(file.relativePath));
  if (scanned.length === 0) return EMPTY_TYPE_AUTHORITY_INDEX;

  return buildTypeAuthorityIndex(
    scanned.map((file) => scannedTypeFileAt(root, file)).filter((file) => file !== null),
  );
};

const indexByRepositoryRoot = new Map<string, TypeAuthorityIndex>();

export const loadRepositoryTypeAuthorityIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): TypeAuthorityIndex => {
  const root = resolve(repositoryRoot);
  const memoized = indexByRepositoryRoot.get(root);
  if (memoized !== undefined) return memoized;

  const built = buildRepositoryTypeAuthorityIndex({ repositoryRoot: root });
  indexByRepositoryRoot.set(root, built);
  return built;
};
