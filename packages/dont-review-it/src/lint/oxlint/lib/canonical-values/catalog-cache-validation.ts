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
  return new Set(value.map(canonicalValueKey)).size === value.length;
};

const isCanonicalValuesEntry = (value: unknown): value is CanonicalValuesEntry => {
  if (value === null || typeof value !== "object") return false;
  if (!hasEntryFields(value)) return false;
  if (!hasValidEntryOffsets(value) || !hasValidEntryIdentity(value)) return false;
  if (!Array.isArray(value.importRoutes) || !value.importRoutes.every(isImportRoute)) return false;
  if (!hasCanonicalValues(value.values)) return false;
  return value.fingerprint === fingerprintValues(value.values);
};

const hasCachedCatalogFields = (
  value: object,
): value is Record<"entries" | "fingerprint" | "integrity" | "version", unknown> =>
  ["entries", "fingerprint", "integrity", "version"].every((field) => field in value);

export const isCachedCatalog = (value: unknown): value is CachedCatalog => {
  if (value === null || typeof value !== "object") return false;
  if (!hasCachedCatalogFields(value)) return false;
  if (value.version !== CACHE_FORMAT_VERSION) return false;
  if (typeof value.fingerprint !== "string" || typeof value.integrity !== "string") return false;
  if (!Array.isArray(value.entries) || !value.entries.every(isCanonicalValuesEntry)) return false;
  return (
    value.integrity === cacheIntegrity({ fingerprint: value.fingerprint, entries: value.entries })
  );
};
