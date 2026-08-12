import { attempt } from "es-toolkit";
import { parse } from "yaml";

import { recordOf, stringEntriesOf } from "./record-fields.ts";

import type { DependencyCatalogChecksConfig } from "./config.ts";

export type CatalogEntry = {
  readonly catalogName: string;
  readonly dependencyName: string;
  readonly version: string;
};

export type OverrideCatalogReference = {
  readonly catalogName: string;
  readonly dependencyName: string;
};

export type WorkspaceDefinition = {
  readonly packagePatterns: readonly string[];
  readonly catalogEntries: readonly CatalogEntry[];
  readonly catalogReferencingOverrides: readonly OverrideCatalogReference[];
};

export const DEFAULT_CATALOG_NAME = "";

const OVERRIDE_SELECTOR_DELIMITER_PATTERN = /[^ |@]>/u;

const overrideTargetName = (overrideKey: string): string => {
  const delimiterIndex = overrideKey.search(OVERRIDE_SELECTOR_DELIMITER_PATTERN);
  const targetSelector =
    delimiterIndex === -1 ? overrideKey : overrideKey.slice(delimiterIndex + 2);
  const trimmedSelector = targetSelector.trim();
  const versionSeparatorIndex = trimmedSelector.indexOf("@", 1);
  return versionSeparatorIndex === -1
    ? trimmedSelector
    : trimmedSelector.slice(0, versionSeparatorIndex);
};

export const catalogReferencingOverridesIn = ({
  overrides,
  config,
}: {
  readonly overrides: unknown;
  readonly config: DependencyCatalogChecksConfig;
}): readonly OverrideCatalogReference[] =>
  stringEntriesOf(overrides)
    .filter(([, specifier]) => specifier.startsWith(config.catalogProtocol))
    .map(([overrideKey, specifier]) => ({
      catalogName: specifier.slice(config.catalogProtocol.length),
      dependencyName: overrideTargetName(overrideKey),
    }));

export const parsedWorkspaceDefinitionOrNull = (definitionSource: {
  readonly source: string;
  readonly config: DependencyCatalogChecksConfig;
}): WorkspaceDefinition | null => {
  const [unparsableSource, definition] = attempt(() => parseWorkspaceDefinition(definitionSource));
  return unparsableSource === null ? definition : null;
};

const parseWorkspaceDefinition = ({
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
    catalogReferencingOverrides: catalogReferencingOverridesIn({
      overrides: definition[config.overridesKey],
      config,
    }),
  };
};
