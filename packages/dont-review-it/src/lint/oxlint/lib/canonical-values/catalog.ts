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
  declarations: readonly CanonicalValuesEntry[],
  keysOf: (declaration: CanonicalValuesEntry) => readonly string[],
): ReadonlyMap<string, readonly CanonicalValuesEntry[]> => {
  const keyed = declarations.flatMap((declaration) =>
    keysOf(declaration).map((groupingKey) => ({ groupingKey, declaration })),
  );

  return new Map(
    Object.entries(groupBy(keyed, (held) => held.groupingKey)).map(([groupingKey, grouped]) => [
      groupingKey,
      uniq(grouped.map((held) => held.declaration)),
    ]),
  );
};

export const buildCatalog = (
  declarations: readonly CanonicalValuesEntry[],
): CanonicalValuesCatalog => ({
  entries: declarations,
  entriesByFingerprint: entriesByKey(declarations, (declaration) => [declaration.fingerprint]),
  entriesByValue: entriesByKey(declarations, (declaration) =>
    declaration.values.map(canonicalValueKey),
  ),
});

export const EMPTY_CANONICAL_VALUES_CATALOG: CanonicalValuesCatalog = buildCatalog([]);
