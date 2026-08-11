import { parse } from "yaml";

import { recordOf, stringEntriesOf } from "./record-fields.ts";

import type { DependencyCatalogChecksConfig } from "./config.ts";

export type CatalogEntry = {
  readonly catalogName: string;
  readonly dependencyName: string;
  readonly version: string;
};

export type WorkspaceDefinition = {
  readonly packagePatterns: readonly string[];
  readonly catalogEntries: readonly CatalogEntry[];
  readonly catalogReferencingOverrideNames: readonly string[];
};

export const DEFAULT_CATALOG_NAME = "";

const overrideTargetName = (overrideKey: string): string => {
  const selectorStart = overrideKey.lastIndexOf(">") + 1;
  const trimmedSelector = overrideKey.slice(selectorStart).trim();
  const versionSeparatorIndex = trimmedSelector.indexOf("@", 1);
  return versionSeparatorIndex === -1
    ? trimmedSelector
    : trimmedSelector.slice(0, versionSeparatorIndex);
};

export const catalogReferencingNamesIn = ({
  overrides,
  config,
}: {
  readonly overrides: unknown;
  readonly config: DependencyCatalogChecksConfig;
}): readonly string[] =>
  stringEntriesOf(overrides)
    .filter(([, specifier]) => specifier.startsWith(config.catalogProtocol))
    .map(([overrideKey]) => overrideTargetName(overrideKey));

export const parseWorkspaceDefinition = ({
  source,
  config,
}: {
  readonly source: string;
  readonly config: DependencyCatalogChecksConfig;
}): WorkspaceDefinition => {
  const definition = recordOf(parse(source));
  const declaredPatterns = definition[config.packagesKey];

  return {
    packagePatterns: Array.isArray(declaredPatterns)
      ? declaredPatterns.filter((pattern): pattern is string => typeof pattern === "string")
      : [],
    catalogEntries: [
      ...stringEntriesOf(definition[config.defaultCatalogKey]).map(([dependencyName, version]) => ({
        catalogName: DEFAULT_CATALOG_NAME,
        dependencyName,
        version,
      })),
      ...Object.entries(recordOf(definition[config.namedCatalogsKey])).flatMap(
        ([catalogName, declaredEntries]) =>
          stringEntriesOf(declaredEntries).map(([dependencyName, version]) => ({
            catalogName,
            dependencyName,
            version,
          })),
      ),
    ],
    catalogReferencingOverrideNames: catalogReferencingNamesIn({
      overrides: definition[config.overridesKey],
      config,
    }),
  };
};
