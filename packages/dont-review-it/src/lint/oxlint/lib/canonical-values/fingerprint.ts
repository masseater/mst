import { createHash } from "node:crypto";

export type CanonicalValue = string | number | boolean;

export const canonicalValueKey = (held: CanonicalValue): string => `${typeof held}:${String(held)}`;

const normalizeValues = (heldValues: readonly CanonicalValue[]): readonly string[] =>
  [...new Set(heldValues.map(canonicalValueKey))].toSorted();

export const fingerprintValues = (heldValues: readonly CanonicalValue[]): string =>
  createHash("sha256").update(normalizeValues(heldValues).join("\0")).digest("hex").slice(0, 32);
