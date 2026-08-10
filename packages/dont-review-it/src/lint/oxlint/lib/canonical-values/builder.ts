import { dirname, join, resolve } from "node:path";

import { containsCanonicalValuesAnnotation } from "./annotation.ts";
import { buildCatalog, EMPTY_CANONICAL_VALUES_CATALOG } from "./catalog.ts";
import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import { scanCanonicalValuesText } from "./declarations.ts";
import { buildExportSpecifierIndex } from "./export-specifier-index.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { isFile, listRepositoryFiles, MANIFEST_FILE_NAME, readTextFile } from "./source-files.ts";

import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";
import type { ScannedFile } from "./source-files.ts";

const nearestPackageDirectory = (fileDirectory: string, repositoryRoot: string): string | null => {
  let directory = fileDirectory;
  for (;;) {
    if (isFile(join(directory, MANIFEST_FILE_NAME))) return directory;
    if (directory === repositoryRoot) return null;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
};

const canonicalValuesEntriesIn = (
  repositoryRoot: string,
  files: readonly ScannedFile[],
): readonly CanonicalValuesEntry[] => {
  const specifierIndexByPackage = new Map<string, ReadonlyMap<string, string>>();
  const specifierIndexFor = (packageDirectory: string): ReadonlyMap<string, string> => {
    const known = specifierIndexByPackage.get(packageDirectory);
    if (known !== undefined) return known;
    const built = buildExportSpecifierIndex(packageDirectory);
    specifierIndexByPackage.set(packageDirectory, built);
    return built;
  };

  const entries: CanonicalValuesEntry[] = [];
  for (const file of files) {
    const sourceText = readTextFile(file.absolutePath);
    if (sourceText === null) continue;
    if (!containsCanonicalValuesAnnotation(sourceText)) continue;

    const { declarations } = scanCanonicalValuesText(sourceText);
    if (declarations.length === 0) continue;

    const packageDirectory = nearestPackageDirectory(dirname(file.absolutePath), repositoryRoot);
    const exportPath =
      packageDirectory === null
        ? null
        : (specifierIndexFor(packageDirectory).get(file.absolutePath) ?? null);

    for (const declaration of declarations) {
      entries.push({
        conceptId: declaration.conceptId,
        declarationPath: file.relativePath,
        exportPath,
        values: declaration.values,
        fingerprint: fingerprintValues(declaration.values),
      });
    }
  }

  return entries.sort((left, right) => {
    const leftKey = `${left.declarationPath} ${left.conceptId}`;
    const rightKey = `${right.declarationPath} ${right.conceptId}`;
    return leftKey === rightKey ? 0 : leftKey < rightKey ? -1 : 1;
  });
};

export const buildCanonicalValuesCatalog = ({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
}): CanonicalValuesCatalog => {
  const root = resolve(repositoryRoot);
  const { declarationSources, manifests } = listRepositoryFiles(root);
  if (declarationSources.length === 0) return EMPTY_CANONICAL_VALUES_CATALOG;

  const fingerprint = cacheInputFingerprint([...declarationSources, ...manifests]);
  const cached = readCachedEntries(root, fingerprint);
  if (cached !== null) return buildCatalog(cached);

  const entries = canonicalValuesEntriesIn(root, declarationSources);
  writeCachedEntries(root, fingerprint, entries);
  return buildCatalog(entries);
};

const catalogByRepositoryRoot = new Map<string, CanonicalValuesCatalog>();

export const loadCanonicalValuesCatalog = (options: {
  readonly repositoryRoot: string;
}): CanonicalValuesCatalog => {
  const root = resolve(options.repositoryRoot);
  const memoized = catalogByRepositoryRoot.get(root);
  if (memoized !== undefined) return memoized;

  const built = buildCanonicalValuesCatalog({ repositoryRoot: root });
  catalogByRepositoryRoot.set(root, built);
  return built;
};
