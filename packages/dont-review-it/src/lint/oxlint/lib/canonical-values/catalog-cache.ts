import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, posix } from "node:path";

import { attempt } from "es-toolkit";

import { isEnvironmentFailure } from "../path-failure.ts";
import {
  canonicalValueKey,
  fingerprintValues,
  isCanonicalValue,
  type CanonicalValue,
} from "./fingerprint.ts";
import { readJsonFile } from "./read-json-file.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";
import type { ScannedFile } from "./source-files.ts";

const CACHE_FORMAT_VERSION = 5;

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
  readonly integrity: string;
  readonly version: number;
};

const updateLengthPrefixed = (hash: ReturnType<typeof createHash>, identity: string): void => {
  hash.update(`${Buffer.byteLength(identity)}:`);
  hash.update(identity);
};

const updateFileFingerprint = (hash: ReturnType<typeof createHash>, file: ScannedFile): void => {
  const contents = readFileSync(file.absolutePath);
  [file.relativePath, file.realPathIdentity, file.symbolicLinkTarget ?? ""].forEach((identity) => {
    updateLengthPrefixed(hash, identity);
  });
  hash.update(`${contents.byteLength}:`);
  hash.update(contents);
};

const updateProblemFingerprint = (
  hash: ReturnType<typeof createHash>,
  problem: { readonly filePath: string; readonly kind: string; readonly line: number },
): void => {
  updateLengthPrefixed(hash, JSON.stringify(problem));
};

export const cacheInputFingerprint = (
  files: readonly ScannedFile[],
  problems: readonly {
    readonly filePath: string;
    readonly kind: string;
    readonly line: number;
  }[] = [],
): string => {
  const hash = createHash("sha256");
  hash.update(String(CACHE_FORMAT_VERSION));
  files.forEach((file) => {
    updateFileFingerprint(hash, file);
  });
  problems.forEach((problem) => {
    updateProblemFingerprint(hash, problem);
  });
  return hash.digest("hex");
};

const cacheIntegrity = ({ fingerprint, entries }: FingerprintedEntries): string =>
  createHash("sha256")
    .update(JSON.stringify({ version: CACHE_FORMAT_VERSION, fingerprint, entries }))
    .digest("hex");

const ENTRY_FIELDS = [
  "annotationStart",
  "binding",
  "bindingStart",
  "conceptId",
  "declarationEnd",
  "declarationPath",
  "declarationStart",
  "fingerprint",
  "importRoutes",
  "packageName",
  "values",
] as const;

type CanonicalValuesEntryFields = Record<(typeof ENTRY_FIELDS)[number], unknown>;

const hasEntryFields = (value: object): value is CanonicalValuesEntryFields =>
  ENTRY_FIELDS.every((field) => field in value);

const hasValidEntryOffsets = (value: CanonicalValuesEntryFields): boolean =>
  Number.isSafeInteger(value.annotationStart) &&
  Number.isSafeInteger(value.bindingStart) &&
  Number.isSafeInteger(value.declarationEnd) &&
  Number.isSafeInteger(value.declarationStart) &&
  (value.annotationStart as number) >= 0 &&
  (value.declarationStart as number) >= 0 &&
  (value.annotationStart as number) < (value.declarationStart as number) &&
  (value.bindingStart as number) >= (value.declarationStart as number) &&
  (value.bindingStart as number) < (value.declarationEnd as number) &&
  (value.declarationEnd as number) > (value.declarationStart as number);

const isPackageName = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && value.length > 0);

const hasValidEntryIdentity = (value: CanonicalValuesEntryFields): boolean =>
  typeof value.binding === "string" &&
  value.binding.length > 0 &&
  typeof value.conceptId === "string" &&
  /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/u.test(value.conceptId) &&
  typeof value.declarationPath === "string" &&
  value.declarationPath.length > 0 &&
  typeof value.fingerprint === "string" &&
  /^[a-f0-9]{32}$/u.test(value.fingerprint) &&
  isPackageName(value.packageName);

const hasEntryFieldTypes = (value: CanonicalValuesEntryFields): boolean =>
  hasValidEntryOffsets(value) && hasValidEntryIdentity(value);

const staysWithinRepository = (path: string): boolean =>
  !isAbsolute(path) && !/^[A-Za-z]:\//u.test(path) && path !== ".." && !path.startsWith("../");

const isResolvedSourcePath = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value !== "." &&
  !value.includes("\0") &&
  !value.includes("\\") &&
  posix.normalize(value) === value &&
  staysWithinRepository(value);

const hasNonemptyStringProperty = (
  value: object,
  property: "exportName" | "specifier",
): boolean => {
  const propertyValue = (value as Partial<Record<typeof property, unknown>>)[property];
  return typeof propertyValue === "string" && propertyValue.length > 0;
};

const hasResolvedSourcePaths = (value: object): boolean => {
  if (!("resolvedSourcePaths" in value)) return false;
  if (!Array.isArray(value.resolvedSourcePaths)) return false;
  if (value.resolvedSourcePaths.length === 0) return false;
  if (!value.resolvedSourcePaths.every(isResolvedSourcePath)) return false;
  return new Set(value.resolvedSourcePaths).size === value.resolvedSourcePaths.length;
};

const isImportRoute = (value: unknown): boolean => {
  if (value === null || typeof value !== "object") return false;
  if (!hasNonemptyStringProperty(value, "exportName")) return false;
  if (!hasNonemptyStringProperty(value, "specifier")) return false;
  return hasResolvedSourcePaths(value);
};

const hasCanonicalValues = (value: unknown): value is readonly CanonicalValue[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  if (!value.every(isCanonicalValue)) return false;
  if (value.some((item) => typeof item === "number" && !Number.isFinite(item))) return false;
  return new Set(value.map(canonicalValueKey)).size === value.length;
};

const isCanonicalValuesEntry = (value: unknown): value is CanonicalValuesEntry => {
  if (value === null || typeof value !== "object") return false;
  if (!hasEntryFields(value)) return false;
  if (!hasEntryFieldTypes(value)) return false;
  if (!Array.isArray(value.importRoutes) || !value.importRoutes.every(isImportRoute)) return false;
  if (!hasCanonicalValues(value.values)) return false;
  return value.fingerprint === fingerprintValues(value.values);
};

const CACHED_CATALOG_FIELDS = ["entries", "fingerprint", "integrity", "version"] as const;

type CachedCatalogFields = Record<(typeof CACHED_CATALOG_FIELDS)[number], unknown>;

const hasCachedCatalogFields = (value: object): value is CachedCatalogFields =>
  CACHED_CATALOG_FIELDS.every((field) => field in value);

const hasCachedCatalogFieldTypes = (
  value: CachedCatalogFields,
): value is CachedCatalogFields & {
  readonly fingerprint: string;
  readonly integrity: string;
  readonly version: number;
} =>
  value.version === CACHE_FORMAT_VERSION &&
  typeof value.fingerprint === "string" &&
  typeof value.integrity === "string";

const isCachedCatalog = (value: unknown): value is CachedCatalog => {
  if (value === null || typeof value !== "object") return false;
  if (!hasCachedCatalogFields(value)) return false;
  if (!hasCachedCatalogFieldTypes(value)) return false;
  if (!Array.isArray(value.entries) || !value.entries.every(isCanonicalValuesEntry)) return false;
  return (
    value.integrity === cacheIntegrity({ fingerprint: value.fingerprint, entries: value.entries })
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
  const temporaryPath = `${path}.${process.pid}.tmp`;
  const payload: CachedCatalog = {
    version: CACHE_FORMAT_VERSION,
    fingerprint,
    entries,
    integrity: cacheIntegrity({ fingerprint, entries }),
  };
  const [unwritableCache] = attempt(() => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporaryPath, JSON.stringify(payload), "utf8");
    renameSync(temporaryPath, path);
  });
  if (unwritableCache === null) return;
  const [uncleanableTemporary] = attempt(() => {
    rmSync(temporaryPath, { force: true });
  });
  if (uncleanableTemporary !== null && !isEnvironmentFailure(uncleanableTemporary)) {
    throw new Error(`the temporary catalog cache at ${temporaryPath} could not be removed`, {
      cause: uncleanableTemporary,
    });
  }
  if (isEnvironmentFailure(unwritableCache)) return;
  throw new Error(`the derived catalog cache at ${path} could not be written`, {
    cause: unwritableCache,
  });
};
