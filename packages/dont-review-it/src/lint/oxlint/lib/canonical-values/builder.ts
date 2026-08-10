import { dirname, resolve } from "node:path";

import { memoize, sortBy } from "es-toolkit";

import { readDeclarationSources, type AnnotatedSource } from "./annotated-sources.ts";
import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import {
  buildCatalog,
  EMPTY_CANONICAL_VALUES_CATALOG,
  type CanonicalValuesCatalog,
  type CanonicalValuesEntry,
} from "./catalog.ts";
import { buildExportSpecifierIndex } from "./export-specifier-index.ts";
import { fingerprintValues } from "./fingerprint.ts";
import { listRepositoryFiles, nearestPackageDirectory } from "./source-files.ts";

const canonicalValuesEntriesIn = (
  repositoryRoot: string,
  sources: readonly AnnotatedSource[],
): readonly CanonicalValuesEntry[] => {
  const specifierIndexFor = memoize(buildExportSpecifierIndex);

  const entries = sources.flatMap((source) => {
    if (source.declarations.length === 0) return [];

    const packageDirectory = nearestPackageDirectory(dirname(source.absolutePath), repositoryRoot);
    const exportPath =
      packageDirectory === null
        ? null
        : (specifierIndexFor(packageDirectory).get(source.absolutePath) ?? null);

    return source.declarations.map((declaration) => ({
      conceptId: declaration.conceptId,
      declarationPath: source.relativePath,
      exportPath,
      values: declaration.values,
      fingerprint: fingerprintValues(declaration.values),
    }));
  });

  return sortBy(entries, ["declarationPath", "conceptId"]);
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
