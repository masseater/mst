import { readTextFile } from "../canonical-values/source-files.ts";
import { repositoryFilesFor } from "../setup-modules/specifier-resolution.ts";

import type { ImportedName } from "../spec-syntax/module-declarations.ts";

export type ClassModule = {
  readonly path: string;
  readonly source: string;
};

const classModulesAt = (paths: readonly string[]): readonly ClassModule[] =>
  paths.flatMap((path) => {
    const found = readTextFile(path);
    return found === null ? [] : [{ path, source: found }];
  });

export const classModulesFor = (asked: {
  readonly file: string;
  readonly source: string;
  readonly workspaceRoot: string;
  readonly imported: ImportedName | null;
}): readonly ClassModule[] => {
  const { file, source, workspaceRoot, imported } = asked;
  if (imported === null) return [{ path: file, source }];

  return classModulesAt(
    repositoryFilesFor({ specifier: imported.specifier, fromFile: file, workspaceRoot }),
  );
};
