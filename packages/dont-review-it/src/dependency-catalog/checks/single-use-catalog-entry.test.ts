import { describe, expect, test } from "vite-plus/test";

import { singleUseCatalogEntryFindings } from "./single-use-catalog-entry.ts";

describe("singleUseCatalogEntryFindings", () => {
  describe("an entry that only one manifest references", () => {
    const it = test.extend("findings", () =>
      singleUseCatalogEntryFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        definitionPath: "pnpm-workspace.yaml",
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
            directReferences: [],
          },
        ],
        overrideReferences: [],
      }));

    it("reports it against the definition, naming the manifest and the version to write there", ({
      findings,
    }) => {
      expect(findings).toStrictEqual([
        {
          entry: { catalogName: "", dependencyName: "react", version: "^19.0.0" },
          problem: {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "The catalog must not hold react while apps/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^19.0.0 into that manifest and delete the entry.",
          },
        },
      ]);
    });
  });

  describe("a direct pin of the same version beside the one catalog reference", () => {
    const it = test.extend("findings", () =>
      singleUseCatalogEntryFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        definitionPath: "pnpm-workspace.yaml",
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
            directReferences: [{ manifestPath: "package.json", specifier: "^19.0.0" }],
          },
        ],
        overrideReferences: [],
      }));

    it("counts that pin as a second user and leaves the entry alone", ({ findings }) => {
      expect(findings).toStrictEqual([]);
    });
  });

  describe("a reference that points at another catalog", () => {
    const it = test.extend("findings", () =>
      singleUseCatalogEntryFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        definitionPath: "pnpm-workspace.yaml",
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "legacy" }],
            directReferences: [],
          },
        ],
        overrideReferences: [],
      }));

    it("leaves the entry alone", ({ findings }) => {
      expect(findings).toStrictEqual([]);
    });
  });

  describe("an entry that nothing references", () => {
    const it = test.extend("findings", () =>
      singleUseCatalogEntryFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        definitionPath: "pnpm-workspace.yaml",
        usages: [],
        overrideReferences: [],
      }));

    it("leaves it to the unused-dependency tooling", ({ findings }) => {
      expect(findings).toStrictEqual([]);
    });
  });

  describe("an override that references the catalog holding the entry", () => {
    const it = test.extend("findings", () =>
      singleUseCatalogEntryFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        definitionPath: "pnpm-workspace.yaml",
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
            directReferences: [],
          },
        ],
        overrideReferences: [{ catalogName: "", dependencyName: "react" }],
      }));

    it("leaves the entry alone", ({ findings }) => {
      expect(findings).toStrictEqual([]);
    });
  });

  describe("an override that references the same name from another catalog", () => {
    const it = test.extend("findings", () =>
      singleUseCatalogEntryFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        definitionPath: "pnpm-workspace.yaml",
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [{ manifestPath: "apps/web/package.json", catalogName: "" }],
            directReferences: [],
          },
        ],
        overrideReferences: [{ catalogName: "legacy", dependencyName: "react" }],
      }));

    it("reports the entry that override does not reach", ({ findings }) => {
      expect(findings).toStrictEqual([
        {
          entry: { catalogName: "", dependencyName: "react", version: "^19.0.0" },
          problem: {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "The catalog must not hold react while apps/web/package.json is the only manifest that uses it, because a catalog entry exists to share one version between manifests. Write ^19.0.0 into that manifest and delete the entry.",
          },
        },
      ]);
    });
  });

  describe("a second manifest that also references the entry", () => {
    const it = test.extend("findings", () =>
      singleUseCatalogEntryFindings({
        catalogEntries: [{ catalogName: "", dependencyName: "react", version: "^19.0.0" }],
        definitionPath: "pnpm-workspace.yaml",
        usages: [
          {
            dependencyName: "react",
            catalogReferences: [
              { manifestPath: "apps/web/package.json", catalogName: "" },
              { manifestPath: "package.json", catalogName: "" },
            ],
            directReferences: [],
          },
        ],
        overrideReferences: [],
      }));

    it("leaves the entry alone", ({ findings }) => {
      expect(findings).toStrictEqual([]);
    });
  });
});
