import { describe, expect, it } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { parseWorkspaceDefinition } from "./workspace-definition.ts";

const config = defaultDependencyCatalogChecksConfig;

const definitionFor = (source: string) => parseWorkspaceDefinition({ source, config });

describe("parseWorkspaceDefinition", () => {
  it("reads the package patterns, the default catalog, and the named catalogs", () => {
    const definition = definitionFor(
      "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\ncatalogs:\n  legacy:\n    react: ^18.0.0\n",
    );

    expect(definition.packagePatterns).toStrictEqual(["packages/*"]);
    expect(definition.catalogEntries).toStrictEqual([
      { catalogName: "", dependencyName: "react", version: "^19.0.0" },
      { catalogName: "legacy", dependencyName: "react", version: "^18.0.0" },
    ]);
  });

  it("reads a definition that is not a mapping as empty", () => {
    expect(definitionFor("42\n")).toStrictEqual({
      packagePatterns: [],
      catalogEntries: [],
      catalogReferencingOverrideNames: [],
    });
  });

  it("drops the package patterns that are not strings", () => {
    expect(definitionFor("packages:\n  - packages/*\n  - 42\n").packagePatterns).toStrictEqual([
      "packages/*",
    ]);
  });

  it("reads a packages field that is not a sequence as no patterns", () => {
    expect(definitionFor("packages: everything\n").packagePatterns).toStrictEqual([]);
  });

  it("drops the catalog entries whose version is not a string", () => {
    expect(definitionFor("catalog:\n  react:\n    pinned: true\n").catalogEntries).toStrictEqual(
      [],
    );
  });

  it("collects the override targets that point back into the catalog", () => {
    const definition = definitionFor('overrides:\n  vite: "catalog:"\n  esbuild: ^0.25.0\n');

    expect(definition.catalogReferencingOverrideNames).toStrictEqual(["vite"]);
  });
});

describe("parseWorkspaceDefinition override targets", () => {
  const overrideNamesFor = (overrideKey: string) =>
    definitionFor(`overrides:\n  "${overrideKey}": "catalog:"\n`).catalogReferencingOverrideNames;

  it("keeps a scoped name whole", () => {
    expect(overrideNamesFor("@scope/vite")).toStrictEqual(["@scope/vite"]);
  });

  it("cuts the version qualifier off a name", () => {
    expect(overrideNamesFor("vite@^6.0.0")).toStrictEqual(["vite"]);
  });

  it("cuts the version qualifier off a scoped name", () => {
    expect(overrideNamesFor("@scope/vite@^6.0.0")).toStrictEqual(["@scope/vite"]);
  });

  it("reads only the last selector of a nested override", () => {
    expect(overrideNamesFor("plugin@1 > vite@^6.0.0")).toStrictEqual(["vite"]);
  });
});
