import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { parsedWorkspaceDefinitionOrNull } from "./workspace-definition.ts";

describe("parsedWorkspaceDefinitionOrNull", () => {
  describe("a definition carrying package patterns, a default catalog, and a named catalog", () => {
    const it = test.extend("parsedWorkspaceDefinition", () =>
      parsedWorkspaceDefinitionOrNull({
        source:
          "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\ncatalogs:\n  legacy:\n    react: ^18.0.0\n",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reads the package patterns, the default catalog, and the named catalogs", ({
      parsedWorkspaceDefinition,
    }) => {
      expect(parsedWorkspaceDefinition).toStrictEqual({
        packagePatterns: ["packages/*"],
        catalogEntries: [
          { catalogName: "", dependencyName: "react", version: "^19.0.0" },
          { catalogName: "legacy", dependencyName: "react", version: "^18.0.0" },
        ],
        catalogReferencingOverrides: [],
      });
    });
  });

  describe("a definition that is not a mapping", () => {
    const it = test.extend("parsedWorkspaceDefinition", () =>
      parsedWorkspaceDefinitionOrNull({
        source: "42\n",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reads as empty", ({ parsedWorkspaceDefinition }) => {
      expect(parsedWorkspaceDefinition).toStrictEqual({
        packagePatterns: [],
        catalogEntries: [],
        catalogReferencingOverrides: [],
      });
    });
  });

  describe("a packages field holding an entry that is not a string", () => {
    const it = test.extend("parsedWorkspaceDefinition", () =>
      parsedWorkspaceDefinitionOrNull({
        source: "packages:\n  - packages/*\n  - 42\n",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("drops the package patterns that are not strings", ({ parsedWorkspaceDefinition }) => {
      expect(parsedWorkspaceDefinition).toStrictEqual({
        packagePatterns: ["packages/*"],
        catalogEntries: [],
        catalogReferencingOverrides: [],
      });
    });
  });

  describe("a packages field that is not a sequence", () => {
    const it = test.extend("parsedWorkspaceDefinition", () =>
      parsedWorkspaceDefinitionOrNull({
        source: "packages: everything\n",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reads as no patterns", ({ parsedWorkspaceDefinition }) => {
      expect(parsedWorkspaceDefinition).toStrictEqual({
        packagePatterns: [],
        catalogEntries: [],
        catalogReferencingOverrides: [],
      });
    });
  });

  describe("a catalog entry whose version is not a string", () => {
    const it = test.extend("parsedWorkspaceDefinition", () =>
      parsedWorkspaceDefinitionOrNull({
        source: "catalog:\n  react:\n    pinned: true\n",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("drops the catalog entry", ({ parsedWorkspaceDefinition }) => {
      expect(parsedWorkspaceDefinition).toStrictEqual({
        packagePatterns: [],
        catalogEntries: [],
        catalogReferencingOverrides: [],
      });
    });
  });

  describe("overrides pointing at the catalog beside one that does not", () => {
    const it = test.extend("parsedWorkspaceDefinition", () =>
      parsedWorkspaceDefinitionOrNull({
        source: 'overrides:\n  vite: "catalog:"\n  esbuild: ^0.25.0\n',
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("collects the override targets that point back into the catalog", ({
      parsedWorkspaceDefinition,
    }) => {
      expect(parsedWorkspaceDefinition).toStrictEqual({
        packagePatterns: [],
        catalogEntries: [],
        catalogReferencingOverrides: [{ catalogName: "", dependencyName: "vite" }],
      });
    });
  });

  describe("an override pointing at a named catalog", () => {
    const it = test.extend("parsedWorkspaceDefinition", () =>
      parsedWorkspaceDefinitionOrNull({
        source: 'overrides:\n  vite: "catalog:legacy"\n',
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("keeps the name of the catalog the override references", ({ parsedWorkspaceDefinition }) => {
      expect(parsedWorkspaceDefinition).toStrictEqual({
        packagePatterns: [],
        catalogEntries: [],
        catalogReferencingOverrides: [{ catalogName: "legacy", dependencyName: "vite" }],
      });
    });
  });

  describe("the key of an override that points at the catalog", () => {
    describe("a scoped name", () => {
      const it = test.extend("parsedWorkspaceDefinition", () =>
        parsedWorkspaceDefinitionOrNull({
          source: 'overrides:\n  "@scope/vite": "catalog:"\n',
          config: defaultDependencyCatalogChecksConfig,
        }));

      it("stays whole", ({ parsedWorkspaceDefinition }) => {
        expect(parsedWorkspaceDefinition).toStrictEqual({
          packagePatterns: [],
          catalogEntries: [],
          catalogReferencingOverrides: [{ catalogName: "", dependencyName: "@scope/vite" }],
        });
      });
    });

    describe("a name carrying a version qualifier", () => {
      const it = test.extend("parsedWorkspaceDefinition", () =>
        parsedWorkspaceDefinitionOrNull({
          source: 'overrides:\n  "vite@^6.0.0": "catalog:"\n',
          config: defaultDependencyCatalogChecksConfig,
        }));

      it("loses the version qualifier", ({ parsedWorkspaceDefinition }) => {
        expect(parsedWorkspaceDefinition).toStrictEqual({
          packagePatterns: [],
          catalogEntries: [],
          catalogReferencingOverrides: [{ catalogName: "", dependencyName: "vite" }],
        });
      });
    });

    describe("a scoped name carrying a version qualifier", () => {
      const it = test.extend("parsedWorkspaceDefinition", () =>
        parsedWorkspaceDefinitionOrNull({
          source: 'overrides:\n  "@scope/vite@^6.0.0": "catalog:"\n',
          config: defaultDependencyCatalogChecksConfig,
        }));

      it("loses the version qualifier and keeps the scope", ({ parsedWorkspaceDefinition }) => {
        expect(parsedWorkspaceDefinition).toStrictEqual({
          packagePatterns: [],
          catalogEntries: [],
          catalogReferencingOverrides: [{ catalogName: "", dependencyName: "@scope/vite" }],
        });
      });
    });

    describe("a parent-child selector", () => {
      const it = test.extend("parsedWorkspaceDefinition", () =>
        parsedWorkspaceDefinitionOrNull({
          source: 'overrides:\n  "plugin@1>vite@^6.0.0": "catalog:"\n',
          config: defaultDependencyCatalogChecksConfig,
        }));

      it("reads the child as the target", ({ parsedWorkspaceDefinition }) => {
        expect(parsedWorkspaceDefinition).toStrictEqual({
          packagePatterns: [],
          catalogEntries: [],
          catalogReferencingOverrides: [{ catalogName: "", dependencyName: "vite" }],
        });
      });
    });

    describe("a range whose operator spells > inside the version qualifier", () => {
      const it = test.extend("parsedWorkspaceDefinition", () =>
        parsedWorkspaceDefinitionOrNull({
          source: 'overrides:\n  "vite@>=6.0.0": "catalog:"\n',
          config: defaultDependencyCatalogChecksConfig,
        }));

      it("keeps the name before the qualifier as the target", ({ parsedWorkspaceDefinition }) => {
        expect(parsedWorkspaceDefinition).toStrictEqual({
          packagePatterns: [],
          catalogEntries: [],
          catalogReferencingOverrides: [{ catalogName: "", dependencyName: "vite" }],
        });
      });
    });

    describe("a spaced > between a parent and a child", () => {
      const it = test.extend("parsedWorkspaceDefinition", () =>
        parsedWorkspaceDefinitionOrNull({
          source: 'overrides:\n  "plugin@1 > vite@^6.0.0": "catalog:"\n',
          config: defaultDependencyCatalogChecksConfig,
        }));

      it("reads the > as part of the version range the way pnpm does", ({
        parsedWorkspaceDefinition,
      }) => {
        expect(parsedWorkspaceDefinition).toStrictEqual({
          packagePatterns: [],
          catalogEntries: [],
          catalogReferencingOverrides: [{ catalogName: "", dependencyName: "plugin" }],
        });
      });
    });
  });
});
