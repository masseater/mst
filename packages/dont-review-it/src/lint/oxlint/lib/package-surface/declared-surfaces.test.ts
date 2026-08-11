import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { range } from "es-toolkit";
import { describe, expect, it } from "vite-plus/test";

import { governingSurfacesOf } from "./declared-surfaces.ts";

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-declared-surfaces-"));

const MODULE_SOURCE = "export const shipped = true;\n";

const writeFixture = (name: string, source: string): string => {
  const path = join(fixtureDir, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, source);
  return path;
};

const writeManifest = (name: string, manifest: unknown): void => {
  writeFixture(`${name}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`);
};

const writePackage = (name: string, manifest: unknown): string => {
  writeManifest(`repo/${name}`, manifest);
  return writeFixture(`repo/${name}/entry.ts`, MODULE_SOURCE);
};

const surfacesFor = (filename: string): ReturnType<typeof governingSurfacesOf> =>
  governingSurfacesOf({ cwd: fixtureDir, filename });

writeFixture("repo/pnpm-workspace.yaml", "packages:\n  - packages/*\n");
writeManifest("repo", { bin: "./cli.ts", main: "./index.js" });
const rootEntry = writeFixture("repo/entry.ts", MODULE_SOURCE);

const bothEntry = writePackage("packages/both", {
  name: "@fixture/both",
  bin: { "fixture-both": "./cli.ts" },
  exports: { ".": "./src/index.ts" },
});
const runnableEntry = writePackage("packages/runnable", {
  name: "@fixture/runnable",
  bin: { "fixture-runnable": "./cli.ts" },
  exports: { "./package.json": "./package.json" },
  scripts: { build: "vp pack" },
});
const blankEntry = writePackage("packages/blank", {
  name: "@fixture/blank",
  bin: "",
  exports: {},
  main: "   ",
  types: null,
});
const legacyEntry = writePackage("packages/legacy", {
  name: "@fixture/legacy",
  module: "./dist/index.js",
  typings: "./dist/index.d.ts",
});
const typedEntry = writePackage("packages/typed", {
  name: "@fixture/typed",
  bin: "./cli.ts",
  types: "./dist/index.d.ts",
});
const arrayedEntry = writePackage("packages/arrayed", {
  name: "@fixture/arrayed",
  exports: { ".": [null, "./dist/index.js"] },
});
const deepEntry = writePackage("packages/deep", {
  name: "@fixture/deep",
  exports: range(0, 12).reduce<unknown>((nested) => ({ default: nested }), "./dist/index.js"),
});
const namelessEntry = writePackage("packages/nameless", {
  bin: "./cli.ts",
  main: "./index.js",
});
const blankNameEntry = writePackage("packages/blank-name", {
  name: "   ",
  bin: "./cli.ts",
  exports: "./index.js",
});
const brokenEntry = writeFixture("repo/packages/broken/entry.ts", MODULE_SOURCE);
writeFixture("repo/packages/broken/package.json", "[]\n");

writeFixture("no-manifest/pnpm-workspace.yaml", "packages: []\n");
const looseEntry = writeFixture("no-manifest/loose.ts", MODULE_SOURCE);

const rememberedEntry = writePackage("packages/remembered", {
  name: "@fixture/remembered",
  bin: "./cli.ts",
});

describe("governingSurfacesOf", () => {
  it("names both surfaces a package declares in one manifest", () => {
    expect(surfacesFor(bothEntry)).toStrictEqual({
      packageName: "@fixture/both",
      manifestPath: "packages/both/package.json",
      runnableFields: ["bin"],
      importableFields: ["exports"],
    });
  });

  it("reads the manifest of the package a nested file belongs to", () => {
    const nested = writeFixture("repo/packages/both/src/deep/inner.ts", MODULE_SOURCE);

    expect(surfacesFor(nested)?.packageName).toBe("@fixture/both");
  });

  it("counts an exports map that only reaches the manifest itself as no import surface", () => {
    expect(surfacesFor(runnableEntry)).toStrictEqual({
      packageName: "@fixture/runnable",
      manifestPath: "packages/runnable/package.json",
      runnableFields: ["bin"],
      importableFields: [],
    });
  });

  it("counts blank and empty declarations as no surface at all", () => {
    expect(surfacesFor(blankEntry)).toStrictEqual({
      packageName: "@fixture/blank",
      manifestPath: "packages/blank/package.json",
      runnableFields: [],
      importableFields: [],
    });
  });

  it("counts the bundler and type entries as an import surface", () => {
    expect(surfacesFor(legacyEntry)?.importableFields).toStrictEqual(["module", "typings"]);
  });

  it("counts a type entry declared beside a runnable entry as the second surface", () => {
    expect(surfacesFor(typedEntry)).toStrictEqual({
      packageName: "@fixture/typed",
      manifestPath: "packages/typed/package.json",
      runnableFields: ["bin"],
      importableFields: ["types"],
    });
  });

  it("reads a target written inside an array of alternatives", () => {
    expect(surfacesFor(arrayedEntry)?.importableFields).toStrictEqual(["exports"]);
  });

  it("stops descending conditions once they nest past the limit", () => {
    expect(surfacesFor(deepEntry)?.importableFields).toStrictEqual([]);
  });

  it("falls back to the directory when the manifest declares no name", () => {
    expect(surfacesFor(namelessEntry)).toStrictEqual({
      packageName: "packages/nameless",
      manifestPath: "packages/nameless/package.json",
      runnableFields: ["bin"],
      importableFields: ["main"],
    });
  });

  it("falls back to the directory when the declared name is blank", () => {
    expect(surfacesFor(blankNameEntry)?.packageName).toBe("packages/blank-name");
  });

  it("names the repository root package by the root itself", () => {
    expect(surfacesFor(rootEntry)).toStrictEqual({
      packageName: ".",
      manifestPath: "package.json",
      runnableFields: ["bin"],
      importableFields: ["main"],
    });
  });

  it("reads no surface from a manifest that is not an object", () => {
    expect(surfacesFor(brokenEntry)).toBeNull();
  });

  it("reads no surface for a file no manifest governs", () => {
    expect(surfacesFor(looseEntry)).toBeNull();
  });

  it("remembers what a manifest declared, so a later rewrite does not change the answer", () => {
    expect(surfacesFor(rememberedEntry)?.importableFields).toStrictEqual([]);

    writeManifest("repo/packages/remembered", {
      name: "@fixture/remembered",
      bin: "./cli.ts",
      exports: { ".": "./src/index.ts" },
    });

    expect(surfacesFor(rememberedEntry)?.importableFields).toStrictEqual([]);
  });
});
