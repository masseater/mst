import { DEFAULT_CATALOG_NAME, type CatalogEntry } from "../workspace-definition.ts";

import type { DependencyCatalogChecksConfig } from "../config.ts";
import type { DependencyUsage } from "../dependency-usage.ts";
import type { DependencyCatalogFindings, DependencyCatalogProblem } from "../problem.ts";

const catalogReferenceSpecifier = ({
  catalogName,
  config,
}: {
  readonly catalogName: string;
  readonly config: DependencyCatalogChecksConfig;
}): string =>
  catalogName === DEFAULT_CATALOG_NAME
    ? config.catalogProtocol
    : `${config.catalogProtocol}${catalogName}`;

const findingsForUsage = ({
  usage,
  entriesForName,
  config,
}: {
  readonly usage: DependencyUsage;
  readonly entriesForName: readonly CatalogEntry[];
  readonly config: DependencyCatalogChecksConfig;
}): DependencyCatalogFindings => {
  const classified = usage.directReferences.map((reference) => ({
    reference,
    matchingEntry: entriesForName.find((listed) => listed.version === reference.specifier),
  }));

  return {
    problems: classified.flatMap(({ reference, matchingEntry }) => {
      if (matchingEntry === undefined) return [];
      const specifier = catalogReferenceSpecifier({
        catalogName: matchingEntry.catalogName,
        config,
      });
      return [
        {
          file: reference.manifestPath,
          line: null,
          message: `${usage.dependencyName} must not carry ${reference.specifier} directly while the catalog already pins that version. Replace the specifier with ${specifier} so one declaration keeps the version.`,
        },
      ];
    }),
    warnings: classified.flatMap(({ reference, matchingEntry }) => {
      if (matchingEntry !== undefined) return [];
      const catalogVersions = entriesForName.map((listed) => listed.version).join(", ");
      return [
        {
          file: reference.manifestPath,
          line: null,
          message: `${usage.dependencyName} is pinned to ${reference.specifier} here while the catalog pins ${catalogVersions}. Align this manifest with the catalog, or update the catalog, whichever version is the intended one.`,
        },
      ];
    }),
  };
};

export const bypassedCatalogFindings = ({
  catalogEntries,
  usages,
  config,
}: {
  readonly catalogEntries: readonly CatalogEntry[];
  readonly usages: readonly DependencyUsage[];
  readonly config: DependencyCatalogChecksConfig;
}): DependencyCatalogFindings => {
  const findings = usages.flatMap((usage) => {
    const entriesForName = catalogEntries.filter(
      (listed) => listed.dependencyName === usage.dependencyName,
    );
    if (entriesForName.length === 0) return [];
    return [findingsForUsage({ usage, entriesForName, config })];
  });

  return {
    problems: findings.flatMap((finding): readonly DependencyCatalogProblem[] => finding.problems),
    warnings: findings.flatMap((finding): readonly DependencyCatalogProblem[] => finding.warnings),
  };
};
