import { uniq } from "es-toolkit";

import {
  DEFAULT_CATALOG_NAME,
  type CatalogEntry,
  type OverrideCatalogReference,
} from "../workspace-definition.ts";

import type { DependencyUsage } from "../dependency-usage.ts";
import type { DependencyCatalogProblem } from "../problem.ts";

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

const hasCatalogVersionDisagreement = ({
  catalogEntries,
  usage,
}: {
  readonly catalogEntries: readonly CatalogEntry[];
  readonly usage: DependencyUsage;
}): boolean =>
  usage.directReferences.some((reference) =>
    catalogEntries.every(
      (catalogEntry) =>
        catalogEntry.dependencyName !== usage.dependencyName ||
        catalogEntry.version !== reference.specifier,
    ),
  );

export type SingleUseCatalogEntryFinding = {
  readonly entry: CatalogEntry;
  readonly problem: DependencyCatalogProblem;
};

export const singleUseCatalogEntryFindings = ({
  catalogEntries,
  definitionPath,
  usages,
  overrideReferences,
}: {
  readonly catalogEntries: readonly CatalogEntry[];
  readonly definitionPath: string;
  readonly usages: readonly DependencyUsage[];
  readonly overrideReferences: readonly OverrideCatalogReference[];
}): readonly SingleUseCatalogEntryFinding[] =>
  catalogEntries.flatMap((catalogEntry) => {
    const overridden = overrideReferences.some(
      (reference) =>
        reference.dependencyName === catalogEntry.dependencyName &&
        reference.catalogName === catalogEntry.catalogName,
    );
    if (overridden) return [];

    const usage = usages.find(
      (candidate) => candidate.dependencyName === catalogEntry.dependencyName,
    );
    if (usage === undefined) return [];
    if (hasCatalogVersionDisagreement({ catalogEntries, usage })) return [];

    const [onlyManifest, secondManifest] = manifestsUsingEntry({ entry: catalogEntry, usage });
    if (onlyManifest === undefined || secondManifest !== undefined) return [];

    const catalogIdentity =
      catalogEntry.catalogName === DEFAULT_CATALOG_NAME
        ? "default"
        : `named ${JSON.stringify(catalogEntry.catalogName)}`;

    return [
      {
        entry: catalogEntry,
        problem: {
          file: definitionPath,
          line: null,
          message: `The ${catalogIdentity} catalog must not hold ${catalogEntry.dependencyName} while ${onlyManifest} is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ${catalogEntry.version} into that manifest and delete the entry.`,
        },
      },
    ];
  });
