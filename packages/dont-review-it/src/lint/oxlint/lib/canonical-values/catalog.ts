import { canonicalValueKey, type CanonicalValue } from "./fingerprint.ts";

import type { GitSourceScope } from "../git-ignored-source.ts";

export { canonicalValueKey };

export type CanonicalValuesImportRoute = {
  readonly exportName: string;
  readonly resolvedSourcePaths: readonly string[];
  readonly specifier: string;
};

export type CanonicalValuesEntry = {
  readonly annotationStart: number;
  readonly binding: string;
  readonly bindingStart: number;
  readonly conceptId: string;
  readonly declarationEnd: number;
  readonly declarationPath: string;
  readonly declarationStart: number;
  readonly importRoutes: readonly CanonicalValuesImportRoute[];
  readonly packageName: string | null;
  readonly values: readonly CanonicalValue[];
  readonly fingerprint: string;
};

export type CanonicalValuesCatalog = {
  readonly entries: readonly CanonicalValuesEntry[];
  readonly entriesByFingerprint: ReadonlyMap<string, readonly CanonicalValuesEntry[]>;
  readonly entriesByValue: ReadonlyMap<string, readonly CanonicalValuesEntry[]>;
  readonly packageNames: ReadonlySet<string>;
  readonly sourceScope: GitSourceScope;
};

const ALL_SOURCES: GitSourceScope = { isIgnored: () => false };

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

export const buildCatalog = (
  entries: readonly CanonicalValuesEntry[],
  options: {
    readonly packageNames?: readonly string[];
    readonly sourceScope?: GitSourceScope;
  } = {},
): CanonicalValuesCatalog => ({
  entries,
  entriesByFingerprint: groupBy(entries, (entry) => [entry.fingerprint]),
  entriesByValue: groupBy(entries, (entry) => entry.values.map(canonicalValueKey)),
  packageNames: new Set(
    options.packageNames ??
      entries.flatMap((entry) => (entry.packageName === null ? [] : [entry.packageName])),
  ),
  sourceScope: options.sourceScope ?? ALL_SOURCES,
});
