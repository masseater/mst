import { createHash } from "node:crypto";

export type CanonicalValue = string | number | boolean;

export const canonicalValueKey = (value: CanonicalValue): string =>
  `${typeof value}:${String(value)}`;

const normalizeValues = (values: readonly CanonicalValue[]): readonly string[] =>
  [...new Set(values.map(canonicalValueKey))].toSorted();

export const fingerprintValues = (values: readonly CanonicalValue[]): string =>
  createHash("sha256").update(normalizeValues(values).join("\0")).digest("hex").slice(0, 32);
