import { resolve } from "node:path";

import {
  listRepositoryFiles,
  readTextFile,
  type ScannedFile,
} from "../canonical-values/source-files.ts";
import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import {
  buildBodyIndex,
  EMPTY_BODY_INDEX,
  type BodyIndex,
  type IndexedFile,
} from "./body-index.ts";
import { declarationsIn } from "./declarations.ts";

const indexedFileAt = (file: ScannedFile): IndexedFile | null => {
  const source = readTextFile(file.absolutePath);
  if (source === null) return null;

  const writtenBodies = declarationsIn(source).map((declaration) => ({
    name: declaration.name,
    line: declaration.line,
    fingerprint: declaration.structure,
    nodeCount: declaration.nodeCount,
  }));
  return writtenBodies.length === 0
    ? null
    : { relativePath: file.relativePath, bodies: writtenBodies };
};

export const buildRepositoryBodyIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): BodyIndex => {
  const root = resolve(repositoryRoot);
  const { declarationSources } = listRepositoryFiles(root);
  const scanned = declarationSources.filter((file) => !isOutOfScopeSource(file.relativePath));
  if (scanned.length === 0) return EMPTY_BODY_INDEX;

  return buildBodyIndex(scanned.map(indexedFileAt).filter((file) => file !== null));
};

const indexByRepositoryRoot = new Map<string, BodyIndex>();

export const loadRepositoryBodyIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): BodyIndex => {
  const root = resolve(repositoryRoot);
  const memoized = indexByRepositoryRoot.get(root);
  if (memoized !== undefined) return memoized;

  const built = buildRepositoryBodyIndex({ repositoryRoot: root });
  indexByRepositoryRoot.set(root, built);
  return built;
};
