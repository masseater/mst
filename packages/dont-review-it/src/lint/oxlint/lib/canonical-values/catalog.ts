import { canonicalValueKey, type CanonicalValue } from "./fingerprint.ts";

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
  listedEntries: readonly CanonicalValuesEntry[],
  keysOf: (entry: CanonicalValuesEntry) => readonly string[],
): ReadonlyMap<string, readonly CanonicalValuesEntry[]> => {
  const grouped = new Map<string, CanonicalValuesEntry[]>();
  for (const listed of listedEntries) {
    for (const named of keysOf(listed)) {
      const bucket = grouped.get(named);
      if (bucket === undefined) {
        grouped.set(named, [listed]);
        continue;
      }
      if (!bucket.includes(listed)) bucket.push(listed);
    }
  }
  return grouped;
};

export const buildCatalog = (
  listedEntries: readonly CanonicalValuesEntry[],
): CanonicalValuesCatalog => ({
  entries: listedEntries,
  entriesByFingerprint: groupBy(listedEntries, (listed) => [listed.fingerprint]),
  entriesByValue: groupBy(listedEntries, (listed) => listed.values.map(canonicalValueKey)),
});

export const EMPTY_CANONICAL_VALUES_CATALOG: CanonicalValuesCatalog = buildCatalog([]);
