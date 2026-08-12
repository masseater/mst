import { resolve } from "node:path";

import { readDeclarationSources } from "./annotated-sources.ts";
import { cacheInputFingerprint, readCachedEntries, writeCachedEntries } from "./catalog-cache.ts";
import { canonicalValuesEntriesIn } from "./catalog-entries.ts";
import {
  buildCatalog,
  EMPTY_CANONICAL_VALUES_CATALOG,
  type CanonicalValuesCatalog,
} from "./catalog.ts";
import { listRepositoryFiles } from "./source-files.ts";

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
  writeCachedEntries(root, { fingerprint, entries });
  return buildCatalog(entries);
};
