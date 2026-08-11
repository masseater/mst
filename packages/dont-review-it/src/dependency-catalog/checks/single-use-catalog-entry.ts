import { uniq } from "es-toolkit";

import type { DependencyUsage } from "../dependency-usage.ts";
import type { DependencyCatalogProblem } from "../problem.ts";
import type { CatalogEntry } from "../workspace-definition.ts";

const manifestsUsingEntry = ({
  entry,
  usage,
}: {
  readonly entry: CatalogEntry;
  readonly usage: DependencyUsage;
}): readonly string[] =>
  uniq([
    ...usage.catalogReferences
      .filter((reference) => reference.catalogName === entry.catalogName)
      .map((reference) => reference.manifestPath),
    ...usage.directReferences
      .filter((reference) => reference.specifier === entry.version)
      .map((reference) => reference.manifestPath),
  ]);

export type SingleUseCatalogEntryFinding = {
  readonly entry: CatalogEntry;
  readonly problem: DependencyCatalogProblem;
};

export const singleUseCatalogEntryFindings = ({
  catalogEntries,
  definitionPath,
  usages,
  overriddenNames,
}: {
  readonly catalogEntries: readonly CatalogEntry[];
  readonly definitionPath: string;
  readonly usages: readonly DependencyUsage[];
  readonly overriddenNames: readonly string[];
}): readonly SingleUseCatalogEntryFinding[] =>
  catalogEntries.flatMap((entry) => {
    if (overriddenNames.includes(entry.dependencyName)) return [];

    const usage = usages.find((candidate) => candidate.dependencyName === entry.dependencyName);
    if (usage === undefined) return [];

    const [onlyManifest, secondManifest] = manifestsUsingEntry({ entry, usage });
    if (onlyManifest === undefined || secondManifest !== undefined) return [];

    return [
      {
        entry,
        problem: {
          file: definitionPath,
          message: `The catalog must not hold ${entry.dependencyName} while ${onlyManifest} is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ${entry.version} into that manifest and delete the entry.`,
        },
      },
    ];
  });
