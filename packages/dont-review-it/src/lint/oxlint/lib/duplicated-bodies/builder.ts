import { resolve } from "node:path";

import { listRepositoryFiles, readTextFile } from "../canonical-values/source-files.ts";
import { buildBodyIndex, EMPTY_BODY_INDEX, MINIMUM_BODY_NODES } from "./body-index.ts";
import { declarationsIn } from "./declarations.ts";

import type { ScannedFile } from "../canonical-values/source-files.ts";
import type { BodyIndex, IndexedFile } from "./body-index.ts";

const indexedFileAt = (file: ScannedFile): IndexedFile | null => {
  const source = readTextFile(file.absolutePath);
  if (source === null) return null;

  const bodies = declarationsIn(source)
    .filter((declaration) => declaration.nodeCount >= MINIMUM_BODY_NODES)
    .map((declaration) => ({
      name: declaration.name,
      line: declaration.line,
      fingerprint: declaration.structure,
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
  if (declarationSources.length === 0) return EMPTY_BODY_INDEX;

  return buildBodyIndex(declarationSources.map(indexedFileAt).filter((file) => file !== null));
};

const indexByRepositoryRoot = new Map<string, BodyIndex>();

export const loadRepositoryBodyIndex = (options: {
  readonly repositoryRoot: string;
}): BodyIndex => {
  const root = resolve(options.repositoryRoot);
  const memoized = indexByRepositoryRoot.get(root);
  if (memoized !== undefined) return memoized;

  const built = buildRepositoryBodyIndex({ repositoryRoot: root });
  indexByRepositoryRoot.set(root, built);
  return built;
};
