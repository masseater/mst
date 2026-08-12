import { DEFAULT_CATALOG_NAME, type CatalogEntry } from "../workspace-definition.ts";

import type { DependencyCatalogChecksConfig } from "../config.ts";
import type { DependencyUsage } from "../dependency-usage.ts";
import type { DependencyCatalogFindings } from "../problem.ts";

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
}): DependencyCatalogFindings => ({
  problems: usage.directReferences.map((reference) => {
    const matchingEntry = entriesForName.find((entry) => entry.version === reference.specifier);
    if (matchingEntry !== undefined) {
      const specifier = catalogReferenceSpecifier({
        catalogName: matchingEntry.catalogName,
        config,
      });
      return {
        file: reference.manifestPath,
        line: null,
        message: `${usage.dependencyName} must not carry ${reference.specifier} directly while the catalog already pins that version. Replace the specifier with ${specifier} so one declaration keeps the version.`,
      };
    }

    const catalogVersions = entriesForName.map((entry) => entry.version).join(", ");
    return {
      file: reference.manifestPath,
      line: null,
      message: `${usage.dependencyName} is pinned to ${reference.specifier} here while the catalog pins ${catalogVersions}. Choose the intended version, keep it in one catalog entry, and replace this manifest's specifier with a reference to that entry.`,
    };
  }),
});

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
      (entry) => entry.dependencyName === usage.dependencyName,
    );
    if (entriesForName.length === 0) return [];
    return [findingsForUsage({ usage, entriesForName, config })];
  });

  return {
    problems: findings.flatMap((finding) => finding.problems),
  };
};
