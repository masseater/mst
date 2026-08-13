import { createHash } from "node:crypto";

export type CanonicalValue = string | number | boolean | null;

export const isCanonicalValue = (candidate: unknown): candidate is CanonicalValue =>
  candidate === null ||
  typeof candidate === "string" ||
  typeof candidate === "number" ||
  typeof candidate === "boolean";

export const canonicalValueKey = (canonicalLiteral: CanonicalValue): string =>
  canonicalLiteral === null
    ? "null:null"
    : `${typeof canonicalLiteral}:${String(canonicalLiteral)}`;

const normalizeValues = (canonicalLiterals: readonly CanonicalValue[]): readonly string[] =>
  [...new Set(canonicalLiterals.map(canonicalValueKey))].toSorted();

export const fingerprintValues = (canonicalLiterals: readonly CanonicalValue[]): string =>
  createHash("sha256")
    .update(JSON.stringify(normalizeValues(canonicalLiterals)))
    .digest("hex")
    .slice(0, 32);
