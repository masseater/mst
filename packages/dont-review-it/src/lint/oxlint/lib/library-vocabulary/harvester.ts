import { dirname, resolve } from "node:path";

import { attempt, memoize } from "es-toolkit";
import {
  SymbolFlags,
  type API,
  type Checker,
  type Snapshot,
  type Symbol as TypeSymbol,
} from "typescript/unstable/sync";

import { nearestPackageDirectory } from "../canonical-values/source-files.ts";
import { isEnvironmentFailure } from "../path-failure.ts";
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
): readonly LibraryVocabularyEntry[] => {
  const declaring =
    (exported.flags & SymbolFlags.Alias) === 0 ? exported : checker.getAliasedSymbol(exported);
  const declared = checker.getDeclaredTypeOfSymbol(declaring);
  if (declared.isErrorType() || !declared.isUnionType()) return [];

  const members = declared.getTypes();
  const admitted: readonly CanonicalValue[] = members.flatMap((member) =>
    member.isStringLiteralType() || member.isNumberLiteralType() ? [member.value] : [],
  );
  if (admitted.length === 0) return [];

  return declaring.declarations.slice(0, 1).map((declaration) => ({
    packageName,
    typeName: exported.name,
    declarationId: `${declaration.path}#${declaration.index}`,
    values: admitted,
    admitsUnnamedValues: admitted.length !== members.length,
  }));
};

const vocabulariesExportedBy = (
  snapshot: Snapshot,
  { packageName, declarationsPath }: DependencyTypeEntry,
): readonly LibraryVocabularyEntry[] => {
  const project = snapshot.getDefaultProjectForFile(declarationsPath);
  if (project === undefined) return [];

  const dependency: CheckedDependency = { checker: project.checker, packageName };
  return [project.program.getSourceFile(declarationsPath)]
    .filter((declarations) => declarations !== undefined)
    .flatMap((declarations) => {
      const moduleSymbol = project.checker.getSymbolAtLocation(declarations);
      return moduleSymbol === undefined ? [] : project.checker.getExportsOfModule(moduleSymbol);
    })
    .flatMap((exported) => declaredVocabularyOf(dependency, exported));
};

const harvestedFrom = (
  api: API,
  typeEntries: readonly DependencyTypeEntry[],
): LibraryVocabularyIndex => {
  const snapshot = api.updateSnapshot({
    openFiles: typeEntries.map((typeEntry) => typeEntry.declarationsPath),
  });
  return buildLibraryVocabularyIndex(
    typeEntries.flatMap((typeEntry) => vocabulariesExportedBy(snapshot, typeEntry)),
  );
};

const harvestedWith = (
  api: API,
  typeEntries: readonly DependencyTypeEntry[],
): LibraryVocabularyIndex => {
  try {
    return harvestedFrom(api, typeEntries);
  } finally {
    api.close();
  }
};

export const createLibraryVocabularyLoader = ({
  openApi,
}: {
  readonly openApi: (packageDirectory: string) => API;
}): LibraryVocabularyLoader => {
  const harvestLibraryVocabulary = memoize((packageDirectory: string): LibraryVocabularyIndex => {
    const typeEntries = dependencyTypeEntries(packageDirectory);
    if (typeEntries.length === 0) return EMPTY_LIBRARY_VOCABULARY_INDEX;

    const [unusableChecker, harvested] = attempt(() =>
      harvestedWith(openApi(packageDirectory), typeEntries),
    );
    if (harvested !== null) return harvested;
    if (isEnvironmentFailure(unusableChecker)) return EMPTY_LIBRARY_VOCABULARY_INDEX;
    throw unusableChecker;
  });

  return ({ filename, repositoryRoot }) => {
    const packageDirectory = nearestPackageDirectory(
      dirname(resolve(filename)),
      resolve(repositoryRoot),
    );
    return packageDirectory === null
      ? EMPTY_LIBRARY_VOCABULARY_INDEX
      : harvestLibraryVocabulary(packageDirectory);
  };
};
