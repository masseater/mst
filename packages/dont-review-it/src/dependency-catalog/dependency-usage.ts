import { groupBy, uniqBy } from "es-toolkit";

import type { DependencyCatalogChecksConfig } from "./config.ts";
import type { DependencyReference } from "./manifest-dependencies.ts";

export type CatalogReference = {
  readonly manifestPath: string;
  readonly catalogName: string;
};

export type DirectReference = {
  readonly manifestPath: string;
  readonly specifier: string;
};

export type DependencyUsage = {
  readonly dependencyName: string;
  readonly catalogReferences: readonly CatalogReference[];
  readonly directReferences: readonly DirectReference[];
};

const REFERENCE_KEY_SEPARATOR = " ";

const catalogReferencesOf = ({
  referencesForName,
  config,
}: {
  readonly referencesForName: readonly DependencyReference[];
  readonly config: DependencyCatalogChecksConfig;
}): readonly CatalogReference[] =>
  uniqBy(
    referencesForName
      .filter((reference) => reference.specifier.startsWith(config.catalogProtocol))
      .map((reference) => ({
        manifestPath: reference.manifestPath,
        catalogName: reference.specifier.slice(config.catalogProtocol.length),
      })),
    (reference) => `${reference.manifestPath}${REFERENCE_KEY_SEPARATOR}${reference.catalogName}`,
  );

const holdableBy = ({
  specifier,
  config,
}: {
  readonly specifier: string;
  readonly config: DependencyCatalogChecksConfig;
}): boolean =>
  !specifier.startsWith(config.catalogProtocol) &&
  !config.uncatalogableProtocols.some((protocol) => specifier.startsWith(protocol));

const directReferencesOf = ({
  referencesForName,
  config,
}: {
  readonly referencesForName: readonly DependencyReference[];
  readonly config: DependencyCatalogChecksConfig;
}): readonly DirectReference[] =>
  uniqBy(
    referencesForName
      .filter((reference) => holdableBy({ specifier: reference.specifier, config }))
      .map((reference) => ({
        manifestPath: reference.manifestPath,
        specifier: reference.specifier,
      })),
    (reference) => `${reference.manifestPath}${REFERENCE_KEY_SEPARATOR}${reference.specifier}`,
  );

export const dependencyUsagesIn = ({
  references,
  config,
}: {
  readonly references: readonly DependencyReference[];
  readonly config: DependencyCatalogChecksConfig;
}): readonly DependencyUsage[] =>
  Object.entries(groupBy(references, (reference) => reference.dependencyName)).map(
    ([dependencyName, referencesForName]) => ({
      dependencyName,
      catalogReferences: catalogReferencesOf({ referencesForName, config }),
      directReferences: directReferencesOf({ referencesForName, config }),
    }),
  );
