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
  declarations: readonly CanonicalValuesEntry[],
  keysOf: (declaration: CanonicalValuesEntry) => readonly string[],
): ReadonlyMap<string, readonly CanonicalValuesEntry[]> => {
  const grouped = new Map<string, CanonicalValuesEntry[]>();
  for (const declaration of declarations) {
    for (const lookupKey of keysOf(declaration)) {
      const bucket = grouped.get(lookupKey);
      if (bucket === undefined) {
        grouped.set(lookupKey, [declaration]);
        continue;
      }
      if (!bucket.includes(declaration)) bucket.push(declaration);
    }
  }
  return grouped;
};

export const buildCatalog = (
  declarations: readonly CanonicalValuesEntry[],
  catalogConfiguration: {
    readonly packageNames?: readonly string[];
    readonly sourceScope?: GitSourceScope;
  } = {},
): CanonicalValuesCatalog => ({
  entries: declarations,
  entriesByFingerprint: groupBy(declarations, (declaration) => [declaration.fingerprint]),
  entriesByValue: groupBy(declarations, (declaration) => declaration.values.map(canonicalValueKey)),
  packageNames: new Set(
    catalogConfiguration.packageNames ??
      declarations.flatMap((declaration) =>
        declaration.packageName === null ? [] : [declaration.packageName],
      ),
  ),
  sourceScope: catalogConfiguration.sourceScope ?? ALL_SOURCES,
});
