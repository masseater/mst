import { resolve } from "node:path";

import { memoize } from "es-toolkit";
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

const buildRepositoryCellClassIndex = memoize((repositoryRoot: string): CellClassIndex => {
  const { declarationSources } = listRepositoryFiles(repositoryRoot);
  const scanned = declarationSources.filter((file) => !isOutOfScopeSource(file.relativePath));
  if (scanned.length === 0) return EMPTY_CELL_CLASS_INDEX;

  return buildCellClassIndex(scanned.map(scannedSourceAt).filter((source) => source !== null));
});

export const loadRepositoryCellClassIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): CellClassIndex => buildRepositoryCellClassIndex(resolve(repositoryRoot));
