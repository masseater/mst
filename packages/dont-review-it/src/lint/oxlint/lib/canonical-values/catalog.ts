import { groupBy, uniq } from "es-toolkit";

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

const entriesByKey = (
  entries: readonly CanonicalValuesEntry[],
  keysOf: (entry: CanonicalValuesEntry) => readonly string[],
): ReadonlyMap<string, readonly CanonicalValuesEntry[]> => {
  const keyed = entries.flatMap((entry) => keysOf(entry).map((key) => ({ key, entry })));

  return new Map(
    Object.entries(groupBy(keyed, (held) => held.key)).map(([key, grouped]) => [
      key,
      uniq(grouped.map((held) => held.entry)),
    ]),
  );
};

export const buildCatalog = (entries: readonly CanonicalValuesEntry[]): CanonicalValuesCatalog => ({
  entries,
  entriesByFingerprint: entriesByKey(entries, (entry) => [entry.fingerprint]),
  entriesByValue: entriesByKey(entries, (entry) => entry.values.map(canonicalValueKey)),
});

export const EMPTY_CANONICAL_VALUES_CATALOG: CanonicalValuesCatalog = buildCatalog([]);
