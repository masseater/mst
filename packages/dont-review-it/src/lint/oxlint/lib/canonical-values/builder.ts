import { dirname, resolve } from "node:path";

import { readDeclarationSources } from "./annotated-sources.ts";
import { buildCatalog, EMPTY_CANONICAL_VALUES_CATALOG } from "./catalog.ts";
import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import { buildExportSpecifierIndex } from "./export-specifier-index.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { listRepositoryFiles, nearestPackageDirectory } from "./source-files.ts";

import type { AnnotatedSource } from "./annotated-sources.ts";
import type { CanonicalValuesCatalog, CanonicalValuesEntry } from "./catalog.ts";

const canonicalValuesEntriesIn = (
  repositoryRoot: string,
  sources: readonly AnnotatedSource[],
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
  for (const source of sources) {
    if (source.declarations.length === 0) continue;

    const packageDirectory = nearestPackageDirectory(dirname(source.absolutePath), repositoryRoot);
    const exportPath =
      packageDirectory === null
        ? null
        : (specifierIndexFor(packageDirectory).get(source.absolutePath) ?? null);

    for (const declaration of source.declarations) {
      entries.push({
        conceptId: declaration.conceptId,
        declarationPath: source.relativePath,
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
  const repositoryFiles = listRepositoryFiles(root);
  if (repositoryFiles.declarationSources.length === 0) return EMPTY_CANONICAL_VALUES_CATALOG;

  const fingerprint = cacheInputFingerprint([
    ...repositoryFiles.declarationSources,
    ...repositoryFiles.manifests,
  ]);
  const cached = readCachedEntries(root, fingerprint);
  if (cached !== null) return buildCatalog(cached);

  const entries = canonicalValuesEntriesIn(root, readDeclarationSources(repositoryFiles));
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
