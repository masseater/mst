import { join, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { defaultDependencyCatalogChecksConfig } from "../../../../dependency-catalog/config.ts";
import { parsedWorkspaceDefinitionOrNull } from "../../../../dependency-catalog/workspace-definition.ts";
import { readTextFile } from "../canonical-values/source-files.ts";

export type CatalogEntryVersion = {
  readonly dependencyName: string;
  readonly declaredVersion: string;
};

export type CatalogEntriesLoader = (options: {
  readonly repositoryRoot: string;
}) => readonly CatalogEntryVersion[];

const registeredEntries: (repositoryRoot: string) => readonly CatalogEntryVersion[] = memoize(
  (repositoryRoot: string): readonly CatalogEntryVersion[] => {
    const config = defaultDependencyCatalogChecksConfig;
    const source = readTextFile(join(repositoryRoot, config.workspaceDefinitionFileName));
    if (source === null) return [];

    const definition = parsedWorkspaceDefinitionOrNull({ source, config });
    if (definition === null) return [];

    return definition.catalogEntries.map((catalogEntry) => ({
      dependencyName: catalogEntry.dependencyName,
      declaredVersion: catalogEntry.version,
    }));
  },
);

export const loadCatalogEntries: CatalogEntriesLoader = ({ repositoryRoot }) =>
  registeredEntries(resolve(repositoryRoot));
