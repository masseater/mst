import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { dependencyUsagesIn } from "./dependency-usage.ts";

describe("dependencyUsagesIn", () => {
  describe("a catalog reference standing beside a direct one", () => {
    const it = test.extend("usages", () =>
      dependencyUsagesIn({
        references: [
          { manifestPath: "package.json", dependencyName: "react", specifier: "catalog:" },
          { manifestPath: "apps/web/package.json", dependencyName: "react", specifier: "^19.0.0" },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("separates the catalog references from the direct ones", ({ usages }) => {
      expect(usages).toStrictEqual([
        {
          dependencyName: "react",
          catalogReferences: [{ manifestPath: "package.json", catalogName: "" }],
          directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^19.0.0" }],
        },
      ]);
    });
  });

  describe("a reference to a named catalog", () => {
    const it = test.extend("usages", () =>
      dependencyUsagesIn({
        references: [
          { manifestPath: "package.json", dependencyName: "react", specifier: "catalog:legacy" },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reads the catalog name that follows the protocol", ({ usages }) => {
      expect(usages).toStrictEqual([
        {
          dependencyName: "react",
          catalogReferences: [{ manifestPath: "package.json", catalogName: "legacy" }],
          directReferences: [],
        },
      ]);
    });
  });

  describe("the specifiers that a catalog cannot hold", () => {
    const it = test.extend("usages", () =>
      dependencyUsagesIn({
        references: [
          { manifestPath: "package.json", dependencyName: "utils", specifier: "workspace:*" },
          { manifestPath: "package.json", dependencyName: "utils", specifier: "link:../utils" },
          { manifestPath: "package.json", dependencyName: "utils", specifier: "file:../utils" },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("leaves them out of the usage", ({ usages }) => {
      expect(usages).toStrictEqual([
        { dependencyName: "utils", catalogReferences: [], directReferences: [] },
      ]);
    });
  });

  describe("a manifest repeating the same reference in two fields", () => {
    const it = test.extend("usages", () =>
      dependencyUsagesIn({
        references: [
          { manifestPath: "package.json", dependencyName: "react", specifier: "^19.0.0" },
          { manifestPath: "package.json", dependencyName: "react", specifier: "^19.0.0" },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("counts it once", ({ usages }) => {
      expect(usages).toStrictEqual([
        {
          dependencyName: "react",
          catalogReferences: [],
          directReferences: [{ manifestPath: "package.json", specifier: "^19.0.0" }],
        },
      ]);
    });
  });

  describe("a manifest declaring two different specifiers for one dependency", () => {
    const it = test.extend("usages", () =>
      dependencyUsagesIn({
        references: [
          { manifestPath: "package.json", dependencyName: "react", specifier: "^19.0.0" },
          { manifestPath: "package.json", dependencyName: "react", specifier: "^18.0.0" },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("keeps them as two references", ({ usages }) => {
      expect(usages).toStrictEqual([
        {
          dependencyName: "react",
          catalogReferences: [],
          directReferences: [
            { manifestPath: "package.json", specifier: "^19.0.0" },
            { manifestPath: "package.json", specifier: "^18.0.0" },
          ],
        },
      ]);
    });
  });
});
