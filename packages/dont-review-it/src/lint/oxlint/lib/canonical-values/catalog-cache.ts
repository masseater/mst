import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { attempt } from "es-toolkit";

import { isEnvironmentFailure } from "../path-failure.ts";
import {
  CACHE_FORMAT_VERSION,
  cacheIntegrity,
  isCachedCatalog,
  type CachedCatalog,
  type FingerprintedEntries,
} from "./catalog-cache-validation.ts";
import { readJsonFile } from "./read-json-file.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";

export { cacheInputFingerprint } from "./catalog-cache-fingerprint.ts";

const CACHE_FILE_SEGMENTS: readonly string[] = [
  "node_modules",
  ".cache",
  "mst-dont-review-it",
  "canonical-values.json",
];

const cacheFilePath = (repositoryRoot: string): string =>
  join(repositoryRoot, ...CACHE_FILE_SEGMENTS);

const usableCacheAt = (path: string): unknown => {
  const [unreadableCache, cached] = attempt(() => readJsonFile(path));
  return unreadableCache === null ? cached : null;
};

export const readCachedEntries = (
  repositoryRoot: string,
  fingerprint: string,
): readonly CanonicalValuesEntry[] | null => {
  const cached = usableCacheAt(cacheFilePath(repositoryRoot));
  if (!isCachedCatalog(cached)) return null;
  return cached.fingerprint === fingerprint ? cached.entries : null;
};

export const writeCachedEntries = (
  repositoryRoot: string,
  { fingerprint, entries }: FingerprintedEntries,
): void => {
  const path = cacheFilePath(repositoryRoot);
  const temporaryPath = `${path}.${process.pid}.tmp`;
  const cacheDocument: CachedCatalog = {
    version: CACHE_FORMAT_VERSION,
    fingerprint,
    entries,
    integrity: cacheIntegrity({ fingerprint, entries }),
  };
  const [unwritableCache] = attempt<unknown, Error>(() => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporaryPath, JSON.stringify(cacheDocument), "utf8");
    renameSync(temporaryPath, path);
  });
  if (unwritableCache === null || isEnvironmentFailure(unwritableCache)) return;
  throw unwritableCache;
};
