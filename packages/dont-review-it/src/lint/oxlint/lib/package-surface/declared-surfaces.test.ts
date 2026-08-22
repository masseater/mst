import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { range } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { governingSurfacesOf } from "./declared-surfaces.ts";

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

describe("governingSurfacesOf", () => {
  describe("a package declaring a runnable and an importable surface in one manifest", () => {
    const it = test.extend("surfacesOfAPackageDeclaringBoth", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "both"), { recursive: true });
      writeFileSync(
        join(root, "packages", "both", "package.json"),
        JSON.stringify({
          name: "@fixture/both",
          bin: { "fixture-both": "./cli.ts" },
          exports: { ".": "./src/index.ts" },
        }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "both", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "both", "entry.ts"),
      });
    });

    it("names both surfaces the manifest declares", ({ surfacesOfAPackageDeclaringBoth }) => {
      expect(surfacesOfAPackageDeclaringBoth).toStrictEqual({
        packageName: "@fixture/both",
        manifestPath: "packages/both/package.json",
        runnableFields: ["bin"],
        importableFields: ["exports"],
      });
    });
  });

  describe("a file nested several directories inside a package", () => {
    const it = test.extend("surfacesOfAFileNestedInsideAPackage", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "both", "src", "deep"), { recursive: true });
      writeFileSync(
        join(root, "packages", "both", "package.json"),
        JSON.stringify({
          name: "@fixture/both",
          bin: { "fixture-both": "./cli.ts" },
          exports: { ".": "./src/index.ts" },
        }),
        "utf8",
      );
      writeFileSync(
        join(root, "packages", "both", "src", "deep", "inner.ts"),
        MODULE_SOURCE,
        "utf8",
      );
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "both", "src", "deep", "inner.ts"),
      });
    });

    it("is read from the manifest of the package that file belongs to", ({
      surfacesOfAFileNestedInsideAPackage,
    }) => {
      expect(surfacesOfAFileNestedInsideAPackage).toStrictEqual({
        packageName: "@fixture/both",
        manifestPath: "packages/both/package.json",
        runnableFields: ["bin"],
        importableFields: ["exports"],
      });
    });
  });

  describe("a package whose exports map only reaches the manifest itself", () => {
    const it = test.extend("surfacesOfAPackageExportingOnlyItsManifest", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "runnable"), { recursive: true });
      writeFileSync(
        join(root, "packages", "runnable", "package.json"),
        JSON.stringify({
          name: "@fixture/runnable",
          bin: { "fixture-runnable": "./cli.ts" },
          exports: { "./package.json": "./package.json" },
          scripts: { build: "vp pack" },
        }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "runnable", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "runnable", "entry.ts"),
      });
    });

    it("counts that map as no import surface", ({ surfacesOfAPackageExportingOnlyItsManifest }) => {
      expect(surfacesOfAPackageExportingOnlyItsManifest).toStrictEqual({
        packageName: "@fixture/runnable",
        manifestPath: "packages/runnable/package.json",
        runnableFields: ["bin"],
        importableFields: [],
      });
    });
  });

  describe("a package declaring blank and empty targets", () => {
    const it = test.extend("surfacesOfAPackageDeclaringBlankTargets", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "blank"), { recursive: true });
      writeFileSync(
        join(root, "packages", "blank", "package.json"),
        JSON.stringify({
          name: "@fixture/blank",
          bin: "",
          exports: {},
          main: "   ",
          types: null,
        }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "blank", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "blank", "entry.ts"),
      });
    });

    it("counts them as no surface at all", ({ surfacesOfAPackageDeclaringBlankTargets }) => {
      expect(surfacesOfAPackageDeclaringBlankTargets).toStrictEqual({
        packageName: "@fixture/blank",
        manifestPath: "packages/blank/package.json",
        runnableFields: [],
        importableFields: [],
      });
    });
  });

  describe("a package declaring a bundler entry beside a type entry", () => {
    const it = test.extend("surfacesOfAPackageDeclaringBundlerAndTypeEntries", ({}, {
      onCleanup,
    }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "legacy"), { recursive: true });
      writeFileSync(
        join(root, "packages", "legacy", "package.json"),
        JSON.stringify({
          name: "@fixture/legacy",
          module: "./dist/index.js",
          typings: "./dist/index.d.ts",
        }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "legacy", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "legacy", "entry.ts"),
      });
    });

    it("counts both as the import surface", ({
      surfacesOfAPackageDeclaringBundlerAndTypeEntries,
    }) => {
      expect(surfacesOfAPackageDeclaringBundlerAndTypeEntries).toStrictEqual({
        packageName: "@fixture/legacy",
        manifestPath: "packages/legacy/package.json",
        runnableFields: [],
        importableFields: ["module", "typings"],
      });
    });
  });

  describe("a package declaring a type entry beside a runnable entry", () => {
    const it = test.extend("surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne", ({}, {
      onCleanup,
    }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "typed"), { recursive: true });
      writeFileSync(
        join(root, "packages", "typed", "package.json"),
        JSON.stringify({
          name: "@fixture/typed",
          bin: "./cli.ts",
          types: "./dist/index.d.ts",
        }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "typed", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "typed", "entry.ts"),
      });
    });

    it("counts the type entry as the second surface", ({
      surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne,
    }) => {
      expect(surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne).toStrictEqual({
        packageName: "@fixture/typed",
        manifestPath: "packages/typed/package.json",
        runnableFields: ["bin"],
        importableFields: ["types"],
      });
    });
  });

  describe("a package writing its target inside an array of alternatives", () => {
    const it = test.extend("surfacesOfAPackageDeclaringAnArrayOfAlternatives", ({}, {
      onCleanup,
    }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "arrayed"), { recursive: true });
      writeFileSync(
        join(root, "packages", "arrayed", "package.json"),
        JSON.stringify({
          name: "@fixture/arrayed",
          exports: { ".": [null, "./dist/index.js"] },
        }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "arrayed", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "arrayed", "entry.ts"),
      });
    });

    it("reads the target out of that array", ({
      surfacesOfAPackageDeclaringAnArrayOfAlternatives,
    }) => {
      expect(surfacesOfAPackageDeclaringAnArrayOfAlternatives).toStrictEqual({
        packageName: "@fixture/arrayed",
        manifestPath: "packages/arrayed/package.json",
        runnableFields: [],
        importableFields: ["exports"],
      });
    });
  });

  describe("a package nesting conditions past the limit", () => {
    const it = test.extend("surfacesOfAPackageNestingConditionsPastTheLimit", ({}, {
      onCleanup,
    }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "deep"), { recursive: true });
      const nested = range(0, 12).reduce<unknown>(
        (condition) => ({ default: condition }),
        "./dist/index.js",
      );
      writeFileSync(
        join(root, "packages", "deep", "package.json"),
        JSON.stringify({ name: "@fixture/deep", exports: nested }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "deep", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "deep", "entry.ts"),
      });
    });

    it("stops descending and reads no surface", ({
      surfacesOfAPackageNestingConditionsPastTheLimit,
    }) => {
      expect(surfacesOfAPackageNestingConditionsPastTheLimit).toStrictEqual({
        packageName: "@fixture/deep",
        manifestPath: "packages/deep/package.json",
        runnableFields: [],
        importableFields: [],
      });
    });
  });

  describe("a package whose manifest declares no name", () => {
    const it = test.extend("surfacesOfAPackageDeclaringNoName", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "nameless"), { recursive: true });
      writeFileSync(
        join(root, "packages", "nameless", "package.json"),
        JSON.stringify({ bin: "./cli.ts", main: "./index.js" }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "nameless", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "nameless", "entry.ts"),
      });
    });

    it("falls back to the directory it stands in", ({ surfacesOfAPackageDeclaringNoName }) => {
      expect(surfacesOfAPackageDeclaringNoName).toStrictEqual({
        packageName: "packages/nameless",
        manifestPath: "packages/nameless/package.json",
        runnableFields: ["bin"],
        importableFields: ["main"],
      });
    });
  });

  describe("a package whose declared name is blank", () => {
    const it = test.extend("surfacesOfAPackageDeclaringABlankName", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "blank-name"), { recursive: true });
      writeFileSync(
        join(root, "packages", "blank-name", "package.json"),
        JSON.stringify({ name: "   ", bin: "./cli.ts", exports: "./index.js" }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "blank-name", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "blank-name", "entry.ts"),
      });
    });

    it("falls back to the directory it stands in", ({ surfacesOfAPackageDeclaringABlankName }) => {
      expect(surfacesOfAPackageDeclaringABlankName).toStrictEqual({
        packageName: "packages/blank-name",
        manifestPath: "packages/blank-name/package.json",
        runnableFields: ["bin"],
        importableFields: ["exports"],
      });
    });
  });

  describe("the manifest standing at the repository root", () => {
    const it = test.extend("surfacesOfTheRepositoryRootPackage", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      writeFileSync(
        join(root, "package.json"),
        JSON.stringify({ bin: "./cli.ts", main: "./index.js" }),
        "utf8",
      );
      writeFileSync(join(root, "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({ cwd: root, filename: join(root, "entry.ts") });
    });

    it("is named by the root itself", ({ surfacesOfTheRepositoryRootPackage }) => {
      expect(surfacesOfTheRepositoryRootPackage).toStrictEqual({
        packageName: ".",
        manifestPath: "package.json",
        runnableFields: ["bin"],
        importableFields: ["main"],
      });
    });
  });

  describe("a manifest that is not an object", () => {
    const it = test.extend("surfacesOfAManifestThatIsNotAnObject", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "broken"), { recursive: true });
      writeFileSync(join(root, "packages", "broken", "package.json"), "[]\n", "utf8");
      writeFileSync(join(root, "packages", "broken", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "broken", "entry.ts"),
      });
    });

    it("governs no surface", ({ surfacesOfAManifestThatIsNotAnObject }) => {
      expect(surfacesOfAManifestThatIsNotAnObject).toBe(null);
    });
  });

  describe("a file no manifest governs", () => {
    const it = test.extend("surfacesOfAFileNoManifestGoverns", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
      writeFileSync(join(root, "loose.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({ cwd: root, filename: join(root, "loose.ts") });
    });

    it("reads no surface for it", ({ surfacesOfAFileNoManifestGoverns }) => {
      expect(surfacesOfAFileNoManifestGoverns).toBe(null);
    });
  });

  describe("a manifest read before any rewrite", () => {
    const it = test.extend("surfacesReadBeforeTheManifestWasRewritten", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "remembered"), { recursive: true });
      writeFileSync(
        join(root, "packages", "remembered", "package.json"),
        JSON.stringify({ name: "@fixture/remembered", bin: "./cli.ts" }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "remembered", "entry.ts"), MODULE_SOURCE, "utf8");
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "remembered", "entry.ts"),
      });
    });

    it("carries the import surface that manifest declared", ({
      surfacesReadBeforeTheManifestWasRewritten,
    }) => {
      expect(surfacesReadBeforeTheManifestWasRewritten).toStrictEqual({
        packageName: "@fixture/remembered",
        manifestPath: "packages/remembered/package.json",
        runnableFields: ["bin"],
        importableFields: [],
      });
    });
  });

  describe("a manifest read again after it was rewritten", () => {
    const it = test.extend("surfacesReadAfterTheManifestWasRewritten", ({}, { onCleanup }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), WORKSPACE_MANIFEST, "utf8");
      mkdirSync(join(root, "packages", "remembered"), { recursive: true });
      writeFileSync(
        join(root, "packages", "remembered", "package.json"),
        JSON.stringify({ name: "@fixture/remembered", bin: "./cli.ts" }),
        "utf8",
      );
      writeFileSync(join(root, "packages", "remembered", "entry.ts"), MODULE_SOURCE, "utf8");
      governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "remembered", "entry.ts"),
      });
      writeFileSync(
        join(root, "packages", "remembered", "package.json"),
        JSON.stringify({
          name: "@fixture/remembered",
          bin: "./cli.ts",
          exports: { ".": "./src/index.ts" },
        }),
        "utf8",
      );
      return governingSurfacesOf({
        cwd: root,
        filename: join(root, "packages", "remembered", "entry.ts"),
      });
    });

    it("still carries what the first read remembered", ({
      surfacesReadAfterTheManifestWasRewritten,
    }) => {
      expect(surfacesReadAfterTheManifestWasRewritten).toStrictEqual({
        packageName: "@fixture/remembered",
        manifestPath: "packages/remembered/package.json",
        runnableFields: ["bin"],
        importableFields: [],
      });
    });
  });
});
