import { canonicalValueKey } from "./fingerprint.ts";

import type { CanonicalValue } from "./fingerprint.ts";

export { canonicalValueKey };

export type CanonicalValuesEntry = {
  readonly conceptId: string;
  readonly declarationPath: string;
  readonly exportPath: string | null;
  readonly values: readonly CanonicalValue[];
  readonly fingerprint: string;
};

export type CanonicalValuesCatalog = {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly entriesByFingerprint: ReadonlyMap<string, readonly CanonicalValuesEntry[]>;
  readonly entriesByValue: ReadonlyMap<string, readonly CanonicalValuesEntry[]>;
};

const groupBy = (
  entries: readonly CanonicalValuesEntry[],
  keysOf: (entry: CanonicalValuesEntry) => readonly string[],
): ReadonlyMap<string, readonly CanonicalValuesEntry[]> => {
  const grouped = new Map<string, CanonicalValuesEntry[]>();
  for (const entry of entries) {
    for (const key of keysOf(entry)) {
      const bucket = grouped.get(key);
      if (bucket === undefined) {
        grouped.set(key, [entry]);
        continue;
      }
      if (!bucket.includes(entry)) bucket.push(entry);
    }
  }
  return grouped;
};

export const buildCatalog = (entries: readonly CanonicalValuesEntry[]): CanonicalValuesCatalog => ({
  entries,
  entriesByFingerprint: groupBy(entries, (entry) => [entry.fingerprint]),
  entriesByValue: groupBy(entries, (entry) => entry.values.map(canonicalValueKey)),
});

export const EMPTY_CANONICAL_VALUES_CATALOG: CanonicalValuesCatalog = buildCatalog([]);
