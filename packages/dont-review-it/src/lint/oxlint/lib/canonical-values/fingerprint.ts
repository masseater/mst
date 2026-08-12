import { createHash } from "node:crypto";

export type CanonicalValue = string | number | boolean | null;

export const isCanonicalValue = (value: unknown): value is CanonicalValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

export const canonicalValueKey = (value: CanonicalValue): string =>
  value === null ? "null:null" : `${typeof value}:${String(value)}`;

const normalizeValues = (values: readonly CanonicalValue[]): readonly string[] =>
  [...new Set(values.map(canonicalValueKey))].toSorted();

export const fingerprintValues = (values: readonly CanonicalValue[]): string =>
  createHash("sha256")
    .update(JSON.stringify(normalizeValues(values)))
    .digest("hex")
    .slice(0, 32);
