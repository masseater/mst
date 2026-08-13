import { describe, expect, test } from "vite-plus/test";

import { defaultDependencyCatalogChecksConfig } from "./config.ts";
import { dependencyReferencesIn } from "./manifest-dependencies.ts";

describe("dependencyReferencesIn", () => {
  describe("a manifest declaring a dependency in every dependency field", () => {
    const it = test.extend("references", () =>
      dependencyReferencesIn({
        manifestPath: "packages/left/package.json",
        manifest: {
          dependencies: { react: "^19.0.0" },
          devDependencies: { typescript: "catalog:" },
          peerDependencies: { vite: "^6.0.0" },
          optionalDependencies: { fsevents: "^2.3.0" },
        },
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("collects the references from every field", ({ references }) => {
      expect(references).toStrictEqual([
        {
          manifestPath: "packages/left/package.json",
          dependencyName: "react",
          specifier: "^19.0.0",
        },
        {
          manifestPath: "packages/left/package.json",
          dependencyName: "typescript",
          specifier: "catalog:",
        },
        {
          manifestPath: "packages/left/package.json",
          dependencyName: "vite",
          specifier: "^6.0.0",
        },
        {
          manifestPath: "packages/left/package.json",
          dependencyName: "fsevents",
          specifier: "^2.3.0",
        },
      ]);
    });
  });

  describe("a manifest that is not a record", () => {
    const it = test.extend("references", () =>
      dependencyReferencesIn({
        manifestPath: "package.json",
        manifest: "broken",
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("reads as no references", ({ references }) => {
      expect(references).toStrictEqual([]);
    });
  });

  describe("an entry whose specifier is not a string", () => {
    const it = test.extend("references", () =>
      dependencyReferencesIn({
        manifestPath: "package.json",
        manifest: { dependencies: { react: 19 } },
        config: defaultDependencyCatalogChecksConfig,
      }));

    it("is dropped", ({ references }) => {
      expect(references).toStrictEqual([]);
    });
  });
});
