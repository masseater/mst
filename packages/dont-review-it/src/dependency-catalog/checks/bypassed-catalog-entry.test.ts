import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "../config.ts";
import { bypassedCatalogFindings } from "./bypassed-catalog-entry.ts";

describe("bypassedCatalogFindings", () => {
  describe("a direct pin whose version the default catalog already holds", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [],
            directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^19.0.0" }],
          },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reports the manifest carrying the pin and asks for the catalog protocol", ({
      findings,
    }) => {
      expect(findings).toStrictEqual({
        problems: [
          {
            file: "apps/web/package.json",
            line: null,
            message:
              "react must not carry ^19.0.0 directly while the catalog already pins that version. Replace the specifier with catalog: so one declaration keeps the version.",
          },
        ],
        warnings: [],
      });
    });
  });

  describe("a direct pin whose version a named catalog holds", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "legacy", dependencyName: "react", version: "^18.0.0" }],
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [],
            directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^18.0.0" }],
          },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("names the catalog that holds the version", ({ findings }) => {
      expect(findings).toStrictEqual({
        problems: [
          {
            file: "apps/web/package.json",
            line: null,
            message:
              "react must not carry ^18.0.0 directly while the catalog already pins that version. Replace the specifier with catalog:legacy so one declaration keeps the version.",
          },
        ],
        warnings: [],
      });
    });
  });

  describe("a direct pin that disagrees with the catalog", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [],
            directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^18.0.0" }],
          },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("warns with both the pin here and the version the catalog holds", ({ findings }) => {
      expect(findings).toStrictEqual({
        problems: [],
        warnings: [
          {
            file: "apps/web/package.json",
            line: null,
            message:
              "react is pinned to ^18.0.0 here while the catalog pins ^19.0.0. Align this manifest with the catalog, or update the catalog, whichever version is the intended one.",
          },
        ],
      });
    });
  });

  describe("a dependency that no catalog holds", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        usages: [
          {
            dependencyName: "typescript",
            catalogReferences: [],
            directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^5.0.0" }],
          },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("leaves it to the shared-dependency check", ({ findings }) => {
      expect(findings).toStrictEqual({ problems: [], warnings: [] });
    });
  });
});
