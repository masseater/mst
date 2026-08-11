export type DependencyCatalogChecksConfig = {
  readonly workspaceDefinitionFileName: string;
  readonly manifestFileName: string;
  readonly packagesKey: string;
  readonly defaultCatalogKey: string;
  readonly namedCatalogsKey: string;
  readonly overridesKey: string;
  readonly rootManifestSettingsKey: string;
  readonly dependencyFields: readonly string[];
  readonly catalogProtocol: string;
  readonly uncatalogableProtocols: readonly string[];
};

export const defaultDependencyCatalogChecksConfig: DependencyCatalogChecksConfig = {
  workspaceDefinitionFileName: "pnpm-workspace.yaml",
  manifestFileName: "package.json",
  packagesKey: "packages",
  defaultCatalogKey: "catalog",
  namedCatalogsKey: "catalogs",
  overridesKey: "overrides",
  rootManifestSettingsKey: "pnpm",
  dependencyFields: ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"],
  catalogProtocol: "catalog:",
  uncatalogableProtocols: ["workspace:", "link:", "file:"],
};
