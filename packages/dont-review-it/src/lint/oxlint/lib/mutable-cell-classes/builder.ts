import { resolve } from "node:path";

import { parseSync } from "oxc-parser";

import {
  listRepositoryFiles,
  readTextFile,
  type ScannedFile,
} from "../canonical-values/source-files.ts";
import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import {
  buildCellClassIndex,
  EMPTY_CELL_CLASS_INDEX,
  type CellClassIndex,
  type ScannedSource,
} from "./cell-class-index.ts";
import { sourceFactsIn } from "./construction-sites.ts";

const scannedSourceAt = (file: ScannedFile): ScannedSource | null => {
  const source = readTextFile(file.absolutePath);
  if (source === null) return null;

  const { program } = parseSync(file.relativePath, source);
  return { relativePath: file.relativePath, facts: sourceFactsIn(program) };
};

export const buildRepositoryCellClassIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): CellClassIndex => {
  const root = resolve(repositoryRoot);
  const { declarationSources } = listRepositoryFiles(root);
  const scanned = declarationSources.filter((file) => !isOutOfScopeSource(file.relativePath));
  if (scanned.length === 0) return EMPTY_CELL_CLASS_INDEX;

  return buildCellClassIndex(scanned.map(scannedSourceAt).filter((source) => source !== null));
};

const indexByRepositoryRoot = new Map<string, CellClassIndex>();

export const loadRepositoryCellClassIndex = (options: {
  readonly repositoryRoot: string;
}): CellClassIndex => {
  const root = resolve(options.repositoryRoot);
  const memoized = indexByRepositoryRoot.get(root);
  if (memoized !== undefined) return memoized;

  const built = buildRepositoryCellClassIndex({ repositoryRoot: root });
  indexByRepositoryRoot.set(root, built);
  return built;
};
