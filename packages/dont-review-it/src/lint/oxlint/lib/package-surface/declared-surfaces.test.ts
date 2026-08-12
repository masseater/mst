import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { range } from "es-toolkit";
import { describe, expect, test } from "vite-plus/test";

import { governingSurfacesOf } from "./declared-surfaces.ts";

const MODULE_SOURCE = "export const shipped = true;\n";

const WORKSPACE_MANIFEST = "packages:\n  - packages/*\n";

const it = test
  .extend("surfacesOfAPackageDeclaringBoth", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAFileNestedInsideAPackage", ({}, { onCleanup }) => {
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
    writeFileSync(join(root, "packages", "both", "src", "deep", "inner.ts"), MODULE_SOURCE, "utf8");
    return governingSurfacesOf({
      cwd: root,
      filename: join(root, "packages", "both", "src", "deep", "inner.ts"),
    });
  })
  .extend("surfacesOfAPackageExportingOnlyItsManifest", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAPackageDeclaringBlankTargets", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAPackageDeclaringBundlerAndTypeEntries", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAPackageDeclaringAnArrayOfAlternatives", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAPackageNestingConditionsPastTheLimit", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAPackageDeclaringNoName", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAPackageDeclaringABlankName", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfTheRepositoryRootPackage", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAManifestThatIsNotAnObject", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesOfAFileNoManifestGoverns", ({}, { onCleanup }) => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "declared-surfaces-")));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n", "utf8");
    writeFileSync(join(root, "loose.ts"), MODULE_SOURCE, "utf8");
    return governingSurfacesOf({ cwd: root, filename: join(root, "loose.ts") });
  })
  .extend("surfacesReadBeforeTheManifestWasRewritten", ({}, { onCleanup }) => {
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
  })
  .extend("surfacesReadAfterTheManifestWasRewritten", ({}, { onCleanup }) => {
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

describe("governingSurfacesOf", () => {
  it("names both surfaces a package declares in one manifest", ({
    surfacesOfAPackageDeclaringBoth,
  }) => {
    expect(surfacesOfAPackageDeclaringBoth).toStrictEqual({
      packageName: "@fixture/both",
      manifestPath: "packages/both/package.json",
      runnableFields: ["bin"],
      importableFields: ["exports"],
    });
  });

  it("reads the manifest of the package a nested file belongs to", ({
    surfacesOfAFileNestedInsideAPackage,
  }) => {
    expect(surfacesOfAFileNestedInsideAPackage).toStrictEqual({
      packageName: "@fixture/both",
      manifestPath: "packages/both/package.json",
      runnableFields: ["bin"],
      importableFields: ["exports"],
    });
  });

  it("counts an exports map that only reaches the manifest itself as no import surface", ({
    surfacesOfAPackageExportingOnlyItsManifest,
  }) => {
    expect(surfacesOfAPackageExportingOnlyItsManifest).toStrictEqual({
      packageName: "@fixture/runnable",
      manifestPath: "packages/runnable/package.json",
      runnableFields: ["bin"],
      importableFields: [],
    });
  });

  it("counts blank and empty declarations as no surface at all", ({
    surfacesOfAPackageDeclaringBlankTargets,
  }) => {
    expect(surfacesOfAPackageDeclaringBlankTargets).toStrictEqual({
      packageName: "@fixture/blank",
      manifestPath: "packages/blank/package.json",
      runnableFields: [],
      importableFields: [],
    });
  });

  it("counts the bundler and type entries as an import surface", ({
    surfacesOfAPackageDeclaringBundlerAndTypeEntries,
  }) => {
    expect(surfacesOfAPackageDeclaringBundlerAndTypeEntries).toStrictEqual({
      packageName: "@fixture/legacy",
      manifestPath: "packages/legacy/package.json",
      runnableFields: [],
      importableFields: ["module", "typings"],
    });
  });

  it("counts a type entry declared beside a runnable entry as the second surface", ({
    surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne,
  }) => {
    expect(surfacesOfAPackageDeclaringATypeEntryBesideARunnableOne).toStrictEqual({
      packageName: "@fixture/typed",
      manifestPath: "packages/typed/package.json",
      runnableFields: ["bin"],
      importableFields: ["types"],
    });
  });

  it("reads a target written inside an array of alternatives", ({
    surfacesOfAPackageDeclaringAnArrayOfAlternatives,
  }) => {
    expect(surfacesOfAPackageDeclaringAnArrayOfAlternatives).toStrictEqual({
      packageName: "@fixture/arrayed",
      manifestPath: "packages/arrayed/package.json",
      runnableFields: [],
      importableFields: ["exports"],
    });
  });

  it("stops descending conditions once they nest past the limit", ({
    surfacesOfAPackageNestingConditionsPastTheLimit,
  }) => {
    expect(surfacesOfAPackageNestingConditionsPastTheLimit).toStrictEqual({
      packageName: "@fixture/deep",
      manifestPath: "packages/deep/package.json",
      runnableFields: [],
      importableFields: [],
    });
  });

  it("falls back to the directory when the manifest declares no name", ({
    surfacesOfAPackageDeclaringNoName,
  }) => {
    expect(surfacesOfAPackageDeclaringNoName).toStrictEqual({
      packageName: "packages/nameless",
      manifestPath: "packages/nameless/package.json",
      runnableFields: ["bin"],
      importableFields: ["main"],
    });
  });

  it("falls back to the directory when the declared name is blank", ({
    surfacesOfAPackageDeclaringABlankName,
  }) => {
    expect(surfacesOfAPackageDeclaringABlankName).toStrictEqual({
      packageName: "packages/blank-name",
      manifestPath: "packages/blank-name/package.json",
      runnableFields: ["bin"],
      importableFields: ["exports"],
    });
  });

  it("names the repository root package by the root itself", ({
    surfacesOfTheRepositoryRootPackage,
  }) => {
    expect(surfacesOfTheRepositoryRootPackage).toStrictEqual({
      packageName: ".",
      manifestPath: "package.json",
      runnableFields: ["bin"],
      importableFields: ["main"],
    });
  });

  it("reads no surface from a manifest that is not an object", ({
    surfacesOfAManifestThatIsNotAnObject,
  }) => {
    expect(surfacesOfAManifestThatIsNotAnObject).toBe(null);
  });

  it("reads no surface for a file no manifest governs", ({ surfacesOfAFileNoManifestGoverns }) => {
    expect(surfacesOfAFileNoManifestGoverns).toBe(null);
  });

  it("reads the import surface a manifest declared before any rewrite", ({
    surfacesReadBeforeTheManifestWasRewritten,
  }) => {
    expect(surfacesReadBeforeTheManifestWasRewritten).toStrictEqual({
      packageName: "@fixture/remembered",
      manifestPath: "packages/remembered/package.json",
      runnableFields: ["bin"],
      importableFields: [],
    });
  });

  it("remembers what a manifest declared, so a later rewrite does not change the answer", ({
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
