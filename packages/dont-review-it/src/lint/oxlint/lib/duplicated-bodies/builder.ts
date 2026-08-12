import { resolve } from "node:path";

import { memoize } from "es-toolkit";

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

  const bodies = declarationsIn(source).map((declaration) => ({
    name: declaration.name,
    line: declaration.line,
    fingerprint: declaration.structure,
    nodeCount: declaration.nodeCount,
  }));
  return bodies.length === 0 ? null : { relativePath: file.relativePath, bodies };
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

const bodyIndexUnder = memoize(
  (repositoryRoot: string): BodyIndex => buildRepositoryBodyIndex({ repositoryRoot }),
);

export const loadRepositoryBodyIndex = (options: { readonly repositoryRoot: string }): BodyIndex =>
  bodyIndexUnder(resolve(options.repositoryRoot));
