import { dirname, resolve } from "node:path";

import { API, SymbolFlags } from "typescript/unstable/sync";

import { nearestPackageDirectory } from "../canonical-values/source-files.ts";
import { dependencyTypeEntries } from "./dependency-types.ts";
import { buildLibraryVocabularyIndex, EMPTY_LIBRARY_VOCABULARY_INDEX } from "./vocabulary-index.ts";

import type { Checker, Snapshot, Symbol as TypeSymbol } from "typescript/unstable/sync";
import type { CanonicalValue } from "../canonical-values/fingerprint.ts";
import type { DependencyTypeEntry } from "./dependency-types.ts";
import type { LibraryVocabularyEntry, LibraryVocabularyIndex } from "./vocabulary-index.ts";
import type { LibraryVocabularyLoader } from "./vocabulary-loader.ts";

const declaredVocabularyOf = (
  checker: Checker,
  packageName: string,
  exported: TypeSymbol,
): LibraryVocabularyEntry | null => {
  const declaring =
    (exported.flags & SymbolFlags.Alias) === 0 ? exported : checker.getAliasedSymbol(exported);
  const declared = checker.getDeclaredTypeOfSymbol(declaring);
  if (declared.isErrorType() || !declared.isUnionType()) return null;

  const admitted: CanonicalValue[] = [];
  let admitsUnnamedValues = false;
  for (const member of declared.getTypes() ?? []) {
    if (member.isStringLiteralType() || member.isNumberLiteralType()) {
      admitted.push(member.value);
      continue;
    }
    admitsUnnamedValues = true;
  }
  if (admitted.length === 0) return null;

  const [declaration] = declaring.declarations;
  if (declaration === undefined) return null;

  return {
    packageName,
    typeName: exported.name,
    declarationId: `${declaration.path}#${declaration.index}`,
    values: admitted,
    admitsUnnamedValues,
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

  const harvested: LibraryVocabularyEntry[] = [];
  for (const exported of project.checker.getExportsOfModule(moduleSymbol)) {
    const entry = declaredVocabularyOf(project.checker, packageName, exported);
    if (entry !== null) harvested.push(entry);
  }
  return harvested;
};

const harvestLibraryVocabulary = (packageDirectory: string): LibraryVocabularyIndex => {
  const typeEntries = dependencyTypeEntries(packageDirectory);
  if (typeEntries.length === 0) return EMPTY_LIBRARY_VOCABULARY_INDEX;

  let api;
  try {
    api = new API({ cwd: packageDirectory });
    const snapshot = api.updateSnapshot({
      openFiles: typeEntries.map((entry) => entry.declarationsPath),
    });
    return buildLibraryVocabularyIndex(
      typeEntries.flatMap((entry) => vocabulariesExportedBy(snapshot, entry)),
    );
  } catch {
    return EMPTY_LIBRARY_VOCABULARY_INDEX;
  } finally {
    api?.close();
  }
};

const indexByPackageDirectory = new Map<string, LibraryVocabularyIndex>();

export const loadLibraryVocabulary: LibraryVocabularyLoader = ({ filename, repositoryRoot }) => {
  const packageDirectory = nearestPackageDirectory(
    dirname(resolve(filename)),
    resolve(repositoryRoot),
  );
  if (packageDirectory === null) return EMPTY_LIBRARY_VOCABULARY_INDEX;

  const memoized = indexByPackageDirectory.get(packageDirectory);
  if (memoized !== undefined) return memoized;

  const harvested = harvestLibraryVocabulary(packageDirectory);
  indexByPackageDirectory.set(packageDirectory, harvested);
  return harvested;
};
