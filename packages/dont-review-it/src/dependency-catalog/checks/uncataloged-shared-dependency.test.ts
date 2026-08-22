import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "../config.ts";
import { sharedDependencyFindings } from "./uncataloged-shared-dependency.ts";

describe("sharedDependencyFindings", () => {
  describe("a dependency two manifests pin to the same version outside the catalog", () => {
    const it = test.extend("findings", () =>
      sharedDependencyFindings({
        usages: [
          {
            dependencyName: "typescript",
            catalogReferences: [],
            directReferences: [
              { manifestPath: "apps/web/package.json", specifier: "^5.0.0" },
              { manifestPath: "packages/repository-checks/package.json", specifier: "^5.0.0" },
            ],
          },
        ],
        catalogedNames: [],
        definitionPath: "pnpm-workspace.yaml",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reports the repeated pin against the workspace definition and names both manifests", ({
      findings,
    }) => {
      expect(findings).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "typescript must not be pinned to ^5.0.0 separately by apps/web/package.json and packages/repository-checks/package.json, because pins that repeat drift apart silently. Add typescript to the catalog and reference it with catalog: from each manifest.",
          },
        ],
      });
    });
  });

  describe("a dependency two manifests pin to different versions", () => {
    const it = test.extend("findings", () =>
      sharedDependencyFindings({
        usages: [
          {
            dependencyName: "typescript",
            catalogReferences: [],
            directReferences: [
              { manifestPath: "apps/web/package.json", specifier: "^5.0.0" },
              { manifestPath: "packages/repository-checks/package.json", specifier: "^5.5.0" },
            ],
          },
        ],
        catalogedNames: [],
        definitionPath: "pnpm-workspace.yaml",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reports the pin each manifest carries without choosing a version", ({ findings }) => {
      expect(findings).toStrictEqual({
        problems: [
          {
            file: "pnpm-workspace.yaml",
            line: null,
            message:
              "typescript is pinned to different specifiers: apps/web/package.json pins ^5.0.0, packages/repository-checks/package.json pins ^5.5.0. Choose the intended version, add it to the catalog, and reference it with catalog: from every listed manifest.",
          },
        ],
      });
    });
  });

  describe("a dependency only one manifest pins", () => {
    const it = test.extend("findings", () =>
      sharedDependencyFindings({
        usages: [
          {
            dependencyName: "typescript",
            catalogReferences: [],
            directReferences: [{ manifestPath: "apps/web/package.json", specifier: "^5.0.0" }],
          },
        ],
        catalogedNames: [],
        definitionPath: "pnpm-workspace.yaml",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("leaves it alone", ({ findings }) => {
      expect(findings).toStrictEqual({ problems: [] });
    });
  });

  describe("a dependency the catalog already holds", () => {
    const it = test.extend("findings", () =>
      sharedDependencyFindings({
        usages: [
          {
            dependencyName: "typescript",
            catalogReferences: [],
            directReferences: [
              { manifestPath: "apps/web/package.json", specifier: "^5.0.0" },
              { manifestPath: "packages/repository-checks/package.json", specifier: "^5.0.0" },
            ],
          },
        ],
        catalogedNames: ["typescript"],
        definitionPath: "pnpm-workspace.yaml",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("leaves it to the catalog checks", ({ findings }) => {
      expect(findings).toStrictEqual({ problems: [] });
    });
  });
});
