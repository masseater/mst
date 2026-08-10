import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { attempt } from "es-toolkit";

import { isEnvironmentFailure } from "../path-failure.ts";
import { readJsonFile } from "./read-json-file.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";
import type { CanonicalValue } from "./fingerprint.ts";
import type { ScannedFile } from "./source-files.ts";

const CACHE_FORMAT_VERSION = 3;

const CACHE_FILE_SEGMENTS: readonly string[] = [
  "node_modules",
  ".cache",
  "mst-dont-review-it",
  "canonical-values.json",
];

export type FingerprintedEntries = {
  readonly fingerprint: string;
  readonly entries: readonly CanonicalValuesEntry[];
};

type CachedCatalog = FingerprintedEntries & {
  readonly version: number;
};

export const cacheInputFingerprint = (files: readonly ScannedFile[]): string => {
  const hash = createHash("sha256");
  hash.update(String(CACHE_FORMAT_VERSION));
  for (const file of files) {
    hash.update(` ${file.relativePath} ${file.size} ${file.mtimeMs}`);
  }
  return hash.digest("hex");
};

const isCanonicalValue = (value: unknown): value is CanonicalValue =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

type CanonicalValuesEntryFields = Record<
  "conceptId" | "declarationPath" | "exportPath" | "values" | "fingerprint",
  unknown
>;

const hasEntryFields = (value: object): value is CanonicalValuesEntryFields =>
  "conceptId" in value &&
  "declarationPath" in value &&
  "exportPath" in value &&
  "values" in value &&
  "fingerprint" in value;

const hasEntryFieldTypes = (value: CanonicalValuesEntryFields): boolean =>
  typeof value.conceptId === "string" &&
  typeof value.declarationPath === "string" &&
  (value.exportPath === null || typeof value.exportPath === "string") &&
  typeof value.fingerprint === "string";

const isCanonicalValuesEntry = (value: unknown): value is CanonicalValuesEntry => {
  if (value === null || typeof value !== "object") return false;
  if (!hasEntryFields(value)) return false;
  if (!hasEntryFieldTypes(value)) return false;
  return Array.isArray(value.values) && value.values.every(isCanonicalValue);
};

const isCachedCatalog = (value: unknown): value is CachedCatalog => {
  if (value === null || typeof value !== "object") return false;
  if (!("version" in value && "fingerprint" in value && "entries" in value)) return false;
  return (
    value.version === CACHE_FORMAT_VERSION &&
    typeof value.fingerprint === "string" &&
    Array.isArray(value.entries) &&
    value.entries.every(isCanonicalValuesEntry)
  );
};

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
  const payload: CachedCatalog = { version: CACHE_FORMAT_VERSION, fingerprint, entries };
  const [unwritableCache] = attempt(() => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(payload), "utf8");
  });
  if (unwritableCache === null || isEnvironmentFailure(unwritableCache)) return;
  throw unwritableCache;
};
