import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "../config.ts";
import { bypassedCatalogFindings } from "./bypassed-catalog-entry.ts";

describe("bypassedCatalogFindings", () => {
  describe("a direct pin whose version the default catalog already holds", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        excludedCatalogEntries: [],
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
      });
    });
  });

  describe("a direct pin whose version a named catalog holds", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "legacy", dependencyName: "react", version: "^18.0.0" }],
        excludedCatalogEntries: [],
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
      });
    });
  });

  describe("a direct pin that disagrees with the catalog", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        excludedCatalogEntries: [],
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [],
            directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^18.0.0" }],
          },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reports both the pin here and the version the catalog holds", ({ findings }) => {
      expect(findings).toStrictEqual({
        problems: [
          {
            file: "apps/web/package.json",
            line: null,
            message:
              "react is pinned to ^18.0.0 here while the catalog pins ^19.0.0. Choose the intended version, keep it in one catalog entry, and replace this manifest's specifier with a reference to that entry.",
          },
        ],
      });
    });
  });

  describe("a direct pin matching a named entry being removed in this run", () => {
    const defaultEntry = {
      catalogName: "",
      dependencyName: "react",
      version: "^19.0.0",
    };
    const legacyEntry = {
      catalogName: "legacy",
      dependencyName: "react",
      version: "^18.0.0",
    };
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [defaultEntry, legacyEntry],
        excludedCatalogEntries: [legacyEntry],
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [
              { manifestPath: "apps/web/package.json", catalogName: "" },
              { manifestPath: "apps/site/package.json", catalogName: "" },
            ],
            directReferences: [
              { manifestPath: "packages/legacy/package.json", specifier: "^18.0.0" },
            ],
          },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("leaves that pin for the run after the named entry is removed", ({ findings }) => {
      expect(findings).toStrictEqual({ problems: [] });
    });
  });

  describe("a direct pin matching both a retained default entry and a removed named entry", () => {
    const defaultEntry = {
      catalogName: "",
      dependencyName: "react",
      version: "^19.0.0",
    };
    const legacyEntry = {
      catalogName: "legacy",
      dependencyName: "react",
      version: "^19.0.0",
    };
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [defaultEntry, legacyEntry],
        excludedCatalogEntries: [legacyEntry],
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [
              { manifestPath: "apps/web/package.json", catalogName: "" },
              { manifestPath: "apps/site/package.json", catalogName: "" },
            ],
            directReferences: [
              { manifestPath: "packages/legacy/package.json", specifier: "^19.0.0" },
            ],
          },
        ],
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("leaves that pin for the run after the named entry is removed", ({ findings }) => {
      expect(findings).toStrictEqual({ problems: [] });
    });
  });

  describe("a dependency that no catalog holds", () => {
    const it = test.extend("findings", () =>
      bypassedCatalogFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        excludedCatalogEntries: [],
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
      expect(findings).toStrictEqual({ problems: [] });
    });
  });
});
