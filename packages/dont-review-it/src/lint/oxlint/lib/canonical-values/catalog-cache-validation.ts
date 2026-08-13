import { createHash } from "node:crypto";
import { isAbsolute, posix } from "node:path";

import {
  canonicalValueKey,
  fingerprintValues,
  isCanonicalValue,
  type CanonicalValue,
} from "./fingerprint.ts";

import type { CanonicalValuesEntry } from "./catalog.ts";

export const CACHE_FORMAT_VERSION = 5;

export type FingerprintedEntries = {
  readonly fingerprint: string;
  readonly entries: readonly CanonicalValuesEntry[];
};

export type CachedCatalog = FingerprintedEntries & {
  readonly integrity: string;
  readonly version: number;
};

export const cacheIntegrity = ({ fingerprint, entries }: FingerprintedEntries): string =>
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

const hasEntryFields = (candidate: object): candidate is CanonicalValuesEntryFields =>
  ENTRY_FIELDS.every((field) => field in candidate);

const hasValidEntryOffsets = (candidate: CanonicalValuesEntryFields): boolean =>
  Number.isSafeInteger(candidate.annotationStart) &&
  Number.isSafeInteger(candidate.bindingStart) &&
  Number.isSafeInteger(candidate.declarationEnd) &&
  Number.isSafeInteger(candidate.declarationStart) &&
  (candidate.annotationStart as number) >= 0 &&
  (candidate.declarationStart as number) >= 0 &&
  (candidate.annotationStart as number) < (candidate.declarationStart as number) &&
  (candidate.bindingStart as number) >= (candidate.declarationStart as number) &&
  (candidate.bindingStart as number) < (candidate.declarationEnd as number) &&
  (candidate.declarationEnd as number) > (candidate.declarationStart as number);

const isPackageName = (candidate: unknown): candidate is string | null =>
  candidate === null || (typeof candidate === "string" && candidate.length > 0);

const hasValidEntryIdentity = (candidate: CanonicalValuesEntryFields): boolean =>
  typeof candidate.binding === "string" &&
  candidate.binding.length > 0 &&
  typeof candidate.conceptId === "string" &&
  /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/u.test(candidate.conceptId) &&
  typeof candidate.declarationPath === "string" &&
  candidate.declarationPath.length > 0 &&
  typeof candidate.fingerprint === "string" &&
  /^[a-f0-9]{32}$/u.test(candidate.fingerprint) &&
  isPackageName(candidate.packageName);

const staysWithinRepository = (path: string): boolean =>
  !isAbsolute(path) && !/^[A-Za-z]:\//u.test(path) && path !== ".." && !path.startsWith("../");

const isResolvedSourcePath = (candidate: unknown): candidate is string =>
  typeof candidate === "string" &&
  candidate.length > 0 &&
  candidate !== "." &&
  !candidate.includes("\0") &&
  !candidate.includes("\\") &&
  posix.normalize(candidate) === candidate &&
  staysWithinRepository(candidate);

const hasNonemptyStringProperty = (
  candidate: object,
  property: "exportName" | "specifier",
): boolean => {
  const propertyValue = (candidate as Partial<Record<typeof property, unknown>>)[property];
  return typeof propertyValue === "string" && propertyValue.length > 0;
};

const hasResolvedSourcePaths = (candidate: object): boolean => {
  if (!("resolvedSourcePaths" in candidate)) return false;
  if (!Array.isArray(candidate.resolvedSourcePaths)) return false;
  if (candidate.resolvedSourcePaths.length === 0) return false;
  if (!candidate.resolvedSourcePaths.every(isResolvedSourcePath)) return false;
  return new Set(candidate.resolvedSourcePaths).size === candidate.resolvedSourcePaths.length;
};

const isImportRoute = (candidate: unknown): boolean => {
  if (candidate === null || typeof candidate !== "object") return false;
  if (!hasNonemptyStringProperty(candidate, "exportName")) return false;
  if (!hasNonemptyStringProperty(candidate, "specifier")) return false;
  return hasResolvedSourcePaths(candidate);
};

const hasCanonicalValues = (candidate: unknown): candidate is readonly CanonicalValue[] => {
  if (!Array.isArray(candidate) || candidate.length === 0) return false;
  if (!candidate.every(isCanonicalValue)) return false;
  return new Set(candidate.map(canonicalValueKey)).size === candidate.length;
};

const isCanonicalValuesEntry = (candidate: unknown): candidate is CanonicalValuesEntry => {
  if (candidate === null || typeof candidate !== "object") return false;
  if (!hasEntryFields(candidate)) return false;
  if (!hasValidEntryOffsets(candidate) || !hasValidEntryIdentity(candidate)) return false;
  if (!Array.isArray(candidate.importRoutes) || !candidate.importRoutes.every(isImportRoute))
    return false;
  if (!hasCanonicalValues(candidate.values)) return false;
  return candidate.fingerprint === fingerprintValues(candidate.values);
};

const hasCachedCatalogFields = (
  candidate: object,
): candidate is Record<"entries" | "fingerprint" | "integrity" | "version", unknown> =>
  ["entries", "fingerprint", "integrity", "version"].every((field) => field in candidate);

export const isCachedCatalog = (candidate: unknown): candidate is CachedCatalog => {
  if (candidate === null || typeof candidate !== "object") return false;
  if (!hasCachedCatalogFields(candidate)) return false;
  if (candidate.version !== CACHE_FORMAT_VERSION) return false;
  if (typeof candidate.fingerprint !== "string" || typeof candidate.integrity !== "string")
    return false;
  if (!Array.isArray(candidate.entries) || !candidate.entries.every(isCanonicalValuesEntry))
    return false;
  return (
    candidate.integrity ===
    cacheIntegrity({ fingerprint: candidate.fingerprint, entries: candidate.entries })
  );
};
