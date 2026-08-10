import { dirname, resolve } from "node:path";

import { attempt, memoize } from "es-toolkit";
import {
  API,
  SymbolFlags,
  type Checker,
  type Snapshot,
  type Symbol as TypeSymbol,
} from "typescript/unstable/sync";

import { nearestPackageDirectory } from "../canonical-values/source-files.ts";
import { dependencyTypeEntries, type DependencyTypeEntry } from "./dependency-types.ts";
import {
  buildLibraryVocabularyIndex,
  EMPTY_LIBRARY_VOCABULARY_INDEX,
  type LibraryVocabularyEntry,
  type LibraryVocabularyIndex,
} from "./vocabulary-index.ts";

import type { CanonicalValue } from "../canonical-values/fingerprint.ts";
import type { LibraryVocabularyLoader } from "./vocabulary-loader.ts";

type CheckedDependency = {
  readonly checker: Checker;
  readonly packageName: string;
};

const declaredVocabularyOf = (
  { checker, packageName }: CheckedDependency,
  exported: TypeSymbol,
): LibraryVocabularyEntry | null => {
  const declaring =
    (exported.flags & SymbolFlags.Alias) === 0 ? exported : checker.getAliasedSymbol(exported);
  const declared = checker.getDeclaredTypeOfSymbol(declaring);
  if (declared.isErrorType() || !declared.isUnionType()) return null;

  const members = declared.getTypes() ?? [];
  const admitted: readonly CanonicalValue[] = members.flatMap((member) =>
    member.isStringLiteralType() || member.isNumberLiteralType() ? [member.value] : [],
  );
  if (admitted.length === 0) return null;

  const [declaration] = declaring.declarations;
  if (declaration === undefined) return null;

  return {
    packageName,
    typeName: exported.name,
    declarationId: `${declaration.path}#${declaration.index}`,
    values: admitted,
    admitsUnnamedValues: admitted.length !== members.length,
  };
};

const vocabulariesExportedBy = (
  snapshot: Snapshot,
  { packageName, declarationsPath }: DependencyTypeEntry,
): readonly LibraryVocabularyEntry[] => {
  const project = snapshot.getDefaultProjectForFile(declarationsPath);
  if (project === undefined) return [];
  const declarations = project.program.getSourceFile(declarationsPath);
  if (declarations === undefined) return [];
  const moduleSymbol = project.checker.getSymbolAtLocation(declarations);
  if (moduleSymbol === undefined) return [];

  const dependency: CheckedDependency = { checker: project.checker, packageName };
  return project.checker
    .getExportsOfModule(moduleSymbol)
    .map((exported) => declaredVocabularyOf(dependency, exported))
    .filter((entry) => entry !== null);
};

const harvestedFrom = (
  api: API,
  typeEntries: readonly DependencyTypeEntry[],
): LibraryVocabularyIndex => {
  const snapshot = api.updateSnapshot({
    openFiles: typeEntries.map((entry) => entry.declarationsPath),
  });
  return buildLibraryVocabularyIndex(
    typeEntries.flatMap((entry) => vocabulariesExportedBy(snapshot, entry)),
  );
};

const harvestLibraryVocabulary = memoize((packageDirectory: string): LibraryVocabularyIndex => {
  const typeEntries = dependencyTypeEntries(packageDirectory);
  if (typeEntries.length === 0) return EMPTY_LIBRARY_VOCABULARY_INDEX;

  const [, api] = attempt(() => new API({ cwd: packageDirectory }));
  if (api === null) return EMPTY_LIBRARY_VOCABULARY_INDEX;

  const [, harvested] = attempt(() => harvestedFrom(api, typeEntries));
  api.close();

  return harvested ?? EMPTY_LIBRARY_VOCABULARY_INDEX;
});

export const loadLibraryVocabulary: LibraryVocabularyLoader = ({ filename, repositoryRoot }) => {
  const packageDirectory = nearestPackageDirectory(
    dirname(resolve(filename)),
    resolve(repositoryRoot),
  );
  return packageDirectory === null
    ? EMPTY_LIBRARY_VOCABULARY_INDEX
    : harvestLibraryVocabulary(packageDirectory);
};
