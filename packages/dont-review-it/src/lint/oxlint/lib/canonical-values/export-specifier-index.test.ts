import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { publicPackageEntries, publicPackageName } from "./export-specifier-index.ts";
import { importRouteStatus } from "./import-route.ts";

const ORDER_STATUS_OWNER =
  '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n';

const ORDER_STATUS_RE_EXPORT = 'export { ORDER_STATUSES } from "./order-status.ts";\n';

const ORDER_STATUS_RE_EXPORT_FROM_PARENT = 'export { ORDER_STATUSES } from "../order-status.ts";\n';

const ORDER_STATUS_SHADOW = 'export const ORDER_STATUSES = ["draft", "published"] as const;\n';

const ORDER_STATUS_MODULE_VALUE =
  'import { ORDER_STATUSES } from "./order-status.ts";\nexport = ORDER_STATUSES;\n';

const ORDER_STATUS_SHADOW_MODULE_VALUE =
  'const ORDER_STATUSES = ["draft", "published"] as const;\nexport = ORDER_STATUSES;\n';

describe("export specifier index", () => {
  describe("a package manifest that carries no package name", () => {
    const it = test.extend("publicEntriesOfManifestsWithoutAName", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return [null, [], {}].map((malformedManifest, manifestPosition) => {
        const packageRoot = join(repositoryRoot, `packages/vocabulary-${String(manifestPosition)}`);
        for (const [relativePath, fileText] of Object.entries({
          "package.json": JSON.stringify(malformedManifest),
          "src/order-status.ts": ORDER_STATUS_OWNER,
          "src/index.ts": ORDER_STATUS_RE_EXPORT,
        })) {
          const absolutePath = join(packageRoot, relativePath);
          mkdirSync(dirname(absolutePath), { recursive: true });
          writeFileSync(absolutePath, fileText, "utf8");
        }
        return publicPackageEntries(packageRoot);
      });
    });

    it("publishes no entries", ({ publicEntriesOfManifestsWithoutAName }) => {
      expect(publicEntriesOfManifestsWithoutAName).toStrictEqual([[], [], []]);
    });
  });

  describe("reading the package name out of a malformed manifest", () => {
    const it = test.extend("publicNamesOfMalformedManifests", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      return [null, [], {}, { name: "" }, { name: 1 }].map(
        (malformedManifest, manifestPosition) => {
          const packageRoot = join(
            repositoryRoot,
            `packages/vocabulary-${String(manifestPosition)}`,
          );
          for (const [relativePath, fileText] of Object.entries({
            "package.json": JSON.stringify(malformedManifest),
            "src/order-status.ts": ORDER_STATUS_OWNER,
            "src/index.ts": ORDER_STATUS_RE_EXPORT,
          })) {
            const absolutePath = join(packageRoot, relativePath);
            mkdirSync(dirname(absolutePath), { recursive: true });
            writeFileSync(absolutePath, fileText, "utf8");
          }
          return publicPackageName(packageRoot);
        },
      );
    });

    it("is rejected on its own", ({ publicNamesOfMalformedManifests }) => {
      expect(publicNamesOfMalformedManifests).toStrictEqual([null, null, null, null, null]);
    });
  });

  describe("an exports field naming package.json beside an invalid subpath", () => {
    const it = test.extend("publicEntriesOfInvalidSubpaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: {
            ".": "./src/index.ts",
            invalid: "./src/index.ts",
            "./package.json": "./package.json",
            "./blocked": null,
          },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/vocabulary")).map((publicEntry) =>
        relative(repositoryRoot, publicEntry.sourceFile),
      );
    });

    it("publishes the file behind the root export alone", ({ publicEntriesOfInvalidSubpaths }) => {
      expect(publicEntriesOfInvalidSubpaths).toStrictEqual(["packages/vocabulary/src/index.ts"]);
    });
  });

  describe("the specifiers of an exports field naming package.json and an invalid subpath", () => {
    const it = test.extend("publicSpecifiersOfInvalidSubpaths", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: {
            ".": "./src/index.ts",
            invalid: "./src/index.ts",
            "./package.json": "./package.json",
            "./blocked": null,
          },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/vocabulary")).map(
        (publicEntry) => publicEntry.specifier,
      );
    });

    it("name the package alone", ({ publicSpecifiersOfInvalidSubpaths }) => {
      expect(publicSpecifiersOfInvalidSubpaths).toStrictEqual(["@fixture/vocabulary"]);
    });
  });

  describe("a non-module JSON export beside a script owner route", () => {
    const it = test.extend("importRoutesOfAJsonExport", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/index.ts", "./config": "./config.json" },
        }),
        "packages/vocabulary/config.json": "{}\n",
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("leaves the script owner route standing", ({ importRoutesOfAJsonExport }) => {
      expect(importRoutesOfAJsonExport).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
          specifier: "@fixture/vocabulary",
        },
      ]);
    });
  });

  describe("a fallback of non-runtime and exhausted targets", () => {
    const it = test.extend("publicEntriesOfAnExhaustedFallback", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: ["types-only", null, "../outside.ts"],
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/vocabulary"));
    });

    it("publishes no source entry", ({ publicEntriesOfAnExhaustedFallback }) => {
      expect(publicEntriesOfAnExhaustedFallback).toStrictEqual([]);
    });
  });

  describe("an exports field holding an empty fallback", () => {
    const it = test.extend("publicEntriesOfAnEmptyFallback", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: [],
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/vocabulary"));
    });

    it("publishes no source entry", ({ publicEntriesOfAnEmptyFallback }) => {
      expect(publicEntriesOfAnEmptyFallback).toStrictEqual([]);
    });
  });

  describe("an exports field whose conditions name no runtime target", () => {
    const it = test.extend("publicEntriesOfATypesOnlyCondition", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { types: "./src/index.d.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/vocabulary"));
    });

    it("publishes no source entry", ({ publicEntriesOfATypesOnlyCondition }) => {
      expect(publicEntriesOfATypesOnlyCondition).toStrictEqual([]);
    });
  });

  describe("a malformed wildcard key beside a wildcard escaping the package", () => {
    const it = test.extend("publicEntriesOfAMalformedWildcard", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "invalid/*": "./src/public/*.ts", "./escape/*": "../public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/vocabulary"));
    });

    it("publishes no source entry", ({ publicEntriesOfAMalformedWildcard }) => {
      expect(publicEntriesOfAMalformedWildcard).toStrictEqual([]);
    });
  });

  describe("a package directory that is not in the checkout", () => {
    const it = test.extend("publicEntriesOfAMissingPackageDirectory", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: "./src/index.ts",
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/missing"));
    });

    it("publishes no entries", ({ publicEntriesOfAMissingPackageDirectory }) => {
      expect(publicEntriesOfAMissingPackageDirectory).toStrictEqual([]);
    });
  });

  describe("reading the package name of a directory that is not in the checkout", () => {
    const it = test.extend("publicNameOfAMissingPackageDirectory", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: "./src/index.ts",
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageName(join(repositoryRoot, "packages/missing"));
    });

    it("finds no package name", ({ publicNameOfAMissingPackageDirectory }) => {
      expect(publicNameOfAMissingPackageDirectory).toBe(null);
    });
  });

  describe("a package manifest that is not an object", () => {
    const it = test.extend("importRoutesOfAnInvalidManifest", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": "null",
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.importRoutes,
      );
    });

    it("grants the owner no import route", ({ importRoutesOfAnInvalidManifest }) => {
      expect(importRoutesOfAnInvalidManifest).toStrictEqual([[]]);
    });
  });

  describe("cataloguing an owner behind a manifest that is not an object", () => {
    const it = test.extend("packageNamesOfAnInvalidManifest", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": "null",
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (catalogedConcept) => catalogedConcept.packageName,
      );
    });

    it("leaves the entry without a package name", ({ packageNamesOfAnInvalidManifest }) => {
      expect(packageNamesOfAnInvalidManifest).toStrictEqual([null]);
    });
  });

  describe("a package manifest without an exports field", () => {
    const it = test.extend("publicEntriesOfAPackageWithoutExports", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({ name: "@fixture/vocabulary" }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      return publicPackageEntries(join(repositoryRoot, "packages/vocabulary"));
    });

    it("exposes no public source entry", ({ publicEntriesOfAPackageWithoutExports }) => {
      expect(publicEntriesOfAPackageWithoutExports).toStrictEqual([]);
    });
  });

  describe("an owner standing behind an export-equals module value", () => {
    const it = test.extend("importRoutesOfAnExportEqualsOwner", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/module.ts", "./shadow": "./src/module-shadow.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes the package module value", ({ importRoutesOfAnExportEqualsOwner }) => {
      expect(importRoutesOfAnExportEqualsOwner).toStrictEqual([
        {
          exportName: "<module>",
          resolvedSourcePaths: ["packages/vocabulary/src/module.ts"],
          specifier: "@fixture/vocabulary",
        },
      ]);
    });
  });

  describe("a single-star export pattern", () => {
    const it = test.extend("importRoutesOfASingleStarPattern", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("expands only the owner source identities", ({ importRoutesOfASingleStarPattern }) => {
      expect(importRoutesOfASingleStarPattern).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
          specifier: "@fixture/vocabulary/owner",
        },
      ]);
    });
  });

  describe("an exact null export beside a wildcard that matches it", () => {
    const it = test.extend("importRoutesOfAnExactNullExport", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./owner": null, "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("overrides the wildcard route", ({ importRoutesOfAnExactNullExport }) => {
      expect(importRoutesOfAnExactNullExport).toStrictEqual([]);
    });
  });

  describe("an exact shadow export beside a wildcard that matches it", () => {
    const it = test.extend("importRoutesOfAnExactShadowExport", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./owner": "./src/shadow.ts", "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("overrides the wildcard owner route", ({ importRoutesOfAnExactShadowExport }) => {
      expect(importRoutesOfAnExactShadowExport).toStrictEqual([]);
    });
  });

  describe("a null pattern written before the broad wildcard it narrows", () => {
    const it = test.extend("importRoutesOfANullPatternWrittenFirst", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./private/*": null, "./*": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/public/private/status.ts":
          'export { ORDER_STATUSES } from "../../order-status.ts";\n',
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("overrides the broad wildcard route", ({ importRoutesOfANullPatternWrittenFirst }) => {
      expect(importRoutesOfANullPatternWrittenFirst).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
          specifier: "@fixture/vocabulary/owner",
        },
      ]);
    });
  });

  describe("a null pattern written after the broad wildcard it narrows", () => {
    const it = test.extend("importRoutesOfANullPatternWrittenLast", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*.ts", "./private/*": null },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/public/private/status.ts":
          'export { ORDER_STATUSES } from "../../order-status.ts";\n',
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("overrides the broad wildcard route", ({ importRoutesOfANullPatternWrittenLast }) => {
      expect(importRoutesOfANullPatternWrittenLast).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
          specifier: "@fixture/vocabulary/owner",
        },
      ]);
    });
  });

  describe("a pattern target written without a file extension", () => {
    const it = test.extend("importRoutesOfAnExtensionlessPattern", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("captures what the existing target path holds", ({
      importRoutesOfAnExtensionlessPattern,
    }) => {
      expect(importRoutesOfAnExtensionlessPattern).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
          specifier: "@fixture/vocabulary/owner.ts",
        },
      ]);
    });
  });

  describe("a pattern whose target has no file in the repository", () => {
    const it = test.extend("importRoutesOfAPatternWithoutAFile", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/missing/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes no route", ({ importRoutesOfAPatternWithoutAFile }) => {
      expect(importRoutesOfAPatternWithoutAFile).toStrictEqual([]);
    });
  });

  describe("a pattern holding a runtime condition that resolves to nothing", () => {
    const it = test.extend("importRoutesOfAnUnresolvedPatternCondition", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: {
            "./*": { browser: "./src/missing/*.ts", default: "./src/public/*.ts" },
          },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes no route", ({ importRoutesOfAnUnresolvedPatternCondition }) => {
      expect(importRoutesOfAnUnresolvedPatternCondition).toStrictEqual([]);
    });
  });

  describe("a pattern whose target names a JavaScript file", () => {
    const it = test.extend("importRoutesOfAJavaScriptTargetPattern", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/*.js" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("resolves the TypeScript source behind it", ({ importRoutesOfAJavaScriptTargetPattern }) => {
      expect(importRoutesOfAJavaScriptTargetPattern).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["packages/vocabulary/src/public/owner.ts"],
          specifier: "@fixture/vocabulary/owner",
        },
      ]);
    });
  });

  describe("a subpath carrying more than one star", () => {
    const it = test.extend("importRoutesOfAMultiStarSubpath", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./**": "./src/public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes no route", ({ importRoutesOfAMultiStarSubpath }) => {
      expect(importRoutesOfAMultiStarSubpath).toStrictEqual([]);
    });
  });

  describe("a target carrying more than one star", () => {
    const it = test.extend("importRoutesOfAMultiStarTarget", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/**/index.*" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes no route", ({ importRoutesOfAMultiStarTarget }) => {
      expect(importRoutesOfAMultiStarTarget).toStrictEqual([]);
    });
  });

  describe("a pattern target standing outside the package", () => {
    const it = test.extend("importRoutesOfAPatternTargetOutsideThePackage", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "../public/*.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes no route", ({ importRoutesOfAPatternTargetOutsideThePackage }) => {
      expect(importRoutesOfAPatternTargetOutsideThePackage).toStrictEqual([]);
    });
  });

  describe("a package target symlinked outside the package", () => {
    const it = test.extend("importRoutesOfASymlinkedTarget", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": "./src/public-link.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
        "shared/index.ts":
          'export { ORDER_STATUSES } from "../packages/vocabulary/src/order-status.ts";\n',
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      symlinkSync(
        "../../../shared/index.ts",
        join(repositoryRoot, "packages/vocabulary/src/public-link.ts"),
      );
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes no route", ({ importRoutesOfASymlinkedTarget }) => {
      expect(importRoutesOfASymlinkedTarget).toStrictEqual([]);
    });
  });

  describe("a pattern target that captures nothing", () => {
    const it = test.extend("importRoutesOfAPatternTargetWithoutACapture", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { "./*": "./src/public/owner.ts" },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("publishes no route", ({ importRoutesOfAPatternTargetWithoutACapture }) => {
      expect(importRoutesOfAPatternTargetWithoutACapture).toStrictEqual([]);
    });
  });

  describe("a conditional route whose runtime target exports a shadow", () => {
    const it = test.extend("importRoutesOfAShadowedCondition", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": { import: "./src/shadow.ts", require: "./src/index.ts" } },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("is rejected", ({ importRoutesOfAShadowedCondition }) => {
      expect(importRoutesOfAShadowedCondition).toStrictEqual([]);
    });
  });

  describe("a conditional route whose runtime targets share the owner export", () => {
    const it = test.extend("importRoutesOfASharedCondition", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": { import: "./src/index.ts", require: "./src/require.ts" } },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("keeps the export every runtime target carries", ({ importRoutesOfASharedCondition }) => {
      expect(importRoutesOfASharedCondition).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: [
            "packages/vocabulary/src/index.ts",
            "packages/vocabulary/src/require.ts",
          ],
          specifier: "@fixture/vocabulary",
        },
      ]);
    });
  });

  describe("a runtime condition that resolves to nothing beside a default reaching the owner", () => {
    const it = test.extend("importRoutesOfAnUnresolvedRuntimeCondition", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": { browser: "./src/missing.ts", default: "./src/index.ts" } },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("fails closed", ({ importRoutesOfAnUnresolvedRuntimeCondition }) => {
      expect(importRoutesOfAnUnresolvedRuntimeCondition).toStrictEqual([]);
    });
  });

  describe("an export fallback whose first resolvable target is a shadow", () => {
    const it = test.extend("importRoutesOfAFallbackReachingAShadow", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": ["./src/shadow.ts", "./src/index.ts"] },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("stops there", ({ importRoutesOfAFallbackReachingAShadow }) => {
      expect(importRoutesOfAFallbackReachingAShadow).toStrictEqual([]);
    });
  });

  describe("an export fallback whose first target resolves to nothing", () => {
    const it = test.extend("importRoutesOfAFallbackReachingTheOwner", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-exports-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          exports: { ".": ["./src/missing.ts", "./src/index.ts"] },
        }),
        "packages/vocabulary/src/order-status.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/require.ts": ORDER_STATUS_RE_EXPORT,
        "packages/vocabulary/src/shadow.ts": ORDER_STATUS_SHADOW,
        "packages/vocabulary/src/module.ts": ORDER_STATUS_MODULE_VALUE,
        "packages/vocabulary/src/module-shadow.ts": ORDER_STATUS_SHADOW_MODULE_VALUE,
        "packages/vocabulary/src/public/owner.ts": ORDER_STATUS_RE_EXPORT_FROM_PARENT,
        "packages/vocabulary/src/public/shadow.ts": ORDER_STATUS_SHADOW,
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const publicCatalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
      return publicCatalog.entries[0]?.importRoutes ?? [];
    });

    it("reaches the owner behind it", ({ importRoutesOfAFallbackReachingTheOwner }) => {
      expect(importRoutesOfAFallbackReachingTheOwner).toStrictEqual([
        {
          exportName: "ORDER_STATUSES",
          resolvedSourcePaths: ["packages/vocabulary/src/index.ts"],
          specifier: "@fixture/vocabulary",
        },
      ]);
    });
  });

  describe("a workspace package whose exports name a types condition", () => {
    const it = test.extend("routeStatusBehindATypesCondition", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-public-route-types-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, fileText] of Object.entries({
        "package.json": JSON.stringify({
          name: "fixture-repository",
          private: true,
          workspaces: ["packages/*"],
        }),
        "tsconfig.json": JSON.stringify({
          compilerOptions: { module: "nodenext", moduleResolution: "nodenext" },
        }),
        "packages/vocabulary/package.json": JSON.stringify({
          name: "@fixture/vocabulary",
          type: "module",
          exports: {
            ".": {
              types: "./src/index.d.ts",
              import: "./src/index.ts",
              default: "./src/index.ts",
            },
          },
        }),
        "packages/vocabulary/src/owner.ts": ORDER_STATUS_OWNER,
        "packages/vocabulary/src/index.ts": 'export { ORDER_STATUSES } from "./owner.ts";\n',
        "packages/vocabulary/src/index.d.ts":
          'export declare const ORDER_STATUSES: readonly ["draft", "published"];\n',
        "src/consumer.ts": "export {};\n",
      })) {
        const absolutePath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, fileText, "utf8");
      }
      const packageLink = join(repositoryRoot, "node_modules/@fixture/vocabulary");
      mkdirSync(dirname(packageLink), { recursive: true });
      symlinkSync("../../packages/vocabulary", packageLink, "dir");
      return importRouteStatus(
        {
          importedName: "ORDER_STATUSES",
          specifier: "@fixture/vocabulary",
          filename: join(repositoryRoot, "src/consumer.ts"),
          repositoryRoot,
        },
        analyzeCanonicalValuesRepository({ repositoryRoot }).catalog,
      );
    });

    it("resolves to the registered runtime route", ({ routeStatusBehindATypesCondition }) => {
      expect(routeStatusBehindATypesCondition).toBe("registered");
    });
  });
});
