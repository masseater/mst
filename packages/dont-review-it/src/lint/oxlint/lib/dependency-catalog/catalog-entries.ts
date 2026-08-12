import { join, resolve } from "node:path";

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

const registeredEntries = (repositoryRoot: string): readonly CatalogEntryVersion[] => {
  const config = defaultDependencyCatalogChecksConfig;
  const source = readTextFile(join(repositoryRoot, config.workspaceDefinitionFileName));
  if (source === null) return [];

  const definition = parsedWorkspaceDefinitionOrNull({ source, config });
  if (definition === null) return [];

  return definition.catalogEntries.map((entry) => ({
    dependencyName: entry.dependencyName,
    declaredVersion: entry.version,
  }));
};

const entriesByRepositoryRoot = new Map<string, readonly CatalogEntryVersion[]>();

export const loadCatalogEntries: CatalogEntriesLoader = ({ repositoryRoot }) => {
  const root = resolve(repositoryRoot);
  const memoized = entriesByRepositoryRoot.get(root);
  if (memoized !== undefined) return memoized;

  const registered = registeredEntries(root);
  entriesByRepositoryRoot.set(root, registered);
  return registered;
};
