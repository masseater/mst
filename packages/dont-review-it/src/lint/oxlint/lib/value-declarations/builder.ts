import { resolve } from "node:path";

import {
  listRepositoryFiles,
  readTextFile,
  type ScannedFile,
} from "../canonical-values/source-files.ts";
import { isOutOfScopeSource } from "../out-of-scope-source.ts";
import {
  buildValueDeclarationIndex,
  type IndexedValueFile,
  type ValueDeclarationIndex,
} from "./declaration-index.ts";
import { valueDeclarationsIn } from "./declarations.ts";

const readValueFileAt = (file: ScannedFile): IndexedValueFile | null => {
  const source = readTextFile(file.absolutePath);
  if (source === null) return null;

  const declarations = valueDeclarationsIn({ source, relativePath: file.relativePath });
  return declarations.length === 0 ? null : { relativePath: file.relativePath, declarations };
};

const buildRepositoryValueDeclarationIndex = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): ValueDeclarationIndex => {
  const { declarationSources } = listRepositoryFiles(resolve(repositoryRoot));

  return buildValueDeclarationIndex(
    declarationSources
      .filter((file) => !isOutOfScopeSource(file.relativePath))
      .map(readValueFileAt)
      .filter((file) => file !== null),
  );
};

const indexByRoot = new Map<string, ValueDeclarationIndex>();

export const loadRepositoryValueDeclarationIndex = (options: {
  readonly repositoryRoot: string;
}): ValueDeclarationIndex => {
  const root = resolve(options.repositoryRoot);
  const held = indexByRoot.get(root);
  if (held !== undefined) return held;

  const built = buildRepositoryValueDeclarationIndex({ repositoryRoot: root });
  indexByRoot.set(root, built);
  return built;
};
