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

const isCanonicalValue = (held: unknown): held is CanonicalValue =>
  typeof held === "string" || typeof held === "number" || typeof held === "boolean";

type CanonicalValuesEntryFields = Record<
  "conceptId" | "declarationPath" | "exportPath" | "values" | "fingerprint",
  unknown
>;

const hasEntryFields = (held: object): held is CanonicalValuesEntryFields =>
  "conceptId" in held &&
  "declarationPath" in held &&
  "exportPath" in held &&
  "values" in held &&
  "fingerprint" in held;

const hasEntryFieldTypes = (held: CanonicalValuesEntryFields): boolean =>
  typeof held.conceptId === "string" &&
  typeof held.declarationPath === "string" &&
  (held.exportPath === null || typeof held.exportPath === "string") &&
  typeof held.fingerprint === "string";

const isCanonicalValuesEntry = (held: unknown): held is CanonicalValuesEntry => {
  if (held === null || typeof held !== "object") return false;
  if (!hasEntryFields(held)) return false;
  if (!hasEntryFieldTypes(held)) return false;
  return Array.isArray(held.values) && held.values.every(isCanonicalValue);
};

const isCachedCatalog = (held: unknown): held is CachedCatalog => {
  if (held === null || typeof held !== "object") return false;
  if (!("version" in held && "fingerprint" in held && "entries" in held)) return false;
  return (
    held.version === CACHE_FORMAT_VERSION &&
    typeof held.fingerprint === "string" &&
    Array.isArray(held.entries) &&
    held.entries.every(isCanonicalValuesEntry)
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
  const carried: CachedCatalog = { version: CACHE_FORMAT_VERSION, fingerprint, entries };
  const [unwritableCache] = attempt(() => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(carried), "utf8");
  });
  if (unwritableCache === null || isEnvironmentFailure(unwritableCache)) return;
  throw new Error(`the derived catalog cache at ${path} could not be written`, {
    cause: unwritableCache,
  });
};
