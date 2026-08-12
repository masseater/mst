import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, parse } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import {
  declaresPublicSubpath,
  isInsideDirectory,
  owningPackageDirectoryOf,
  publicEntryFilesOf,
} from "./package-entries.ts";

const packageDirectoryHolding = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "setup-modules-package-entries-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });

  for (const [relativePath, writtenContent] of Object.entries(files)) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, writtenContent);
  }
  return root;
};

const packageDirectoryDeclaring = (manifest: unknown): string =>
  packageDirectoryHolding({
    "package.json": JSON.stringify(manifest),
    "src/index.ts": "export const entered = 1;\n",
    "src/plugin.ts": "export const plugged = 2;\n",
  });

describe("setup-modules/package-entries", () => {
  test("a manifest that is not an object declares no public entry", () => {
    const directory = packageDirectoryHolding({ "package.json": "[]" });

    expect(publicEntryFilesOf(directory)).toBe(null);
  });

  test("a directory holding no manifest declares no public entry", () => {
    expect(publicEntryFilesOf(packageDirectoryHolding({}))).toBe(null);
  });

  test("an entry named under a condition is taken as the entry of its subpath", () => {
    const directory = packageDirectoryDeclaring({
      name: "@fixture/conditioned",
      exports: { ".": { import: "./src/index.ts" } },
    });

    expect(publicEntryFilesOf(directory)).toStrictEqual([join(directory, "src/index.ts")]);
  });

  test("a subpath offering several entries takes each of them", () => {
    const directory = packageDirectoryDeclaring({
      name: "@fixture/several",
      exports: { ".": ["./src/index.ts", "./src/plugin.ts"] },
    });

    expect(publicEntryFilesOf(directory)).toStrictEqual([
      join(directory, "src/index.ts"),
      join(directory, "src/plugin.ts"),
    ]);
  });

  test("an entry written as a bare specifier is not a file of this package", () => {
    const directory = packageDirectoryDeclaring({
      name: "@fixture/redirected",
      exports: { ".": "other-package/entry.js" },
    });

    expect(publicEntryFilesOf(directory)).toBe(null);
  });

  test("an entry naming a file that was never built declares nothing this reading can follow", () => {
    const directory = packageDirectoryDeclaring({
      name: "@fixture/unbuilt",
      exports: { ".": "./dist/index.js" },
    });

    expect(publicEntryFilesOf(directory)).toBe(null);
  });

  test("a manifest that is not an object declares no subpath", () => {
    const directory = packageDirectoryHolding({ "package.json": "[]" });

    expect(declaresPublicSubpath({ packageDirectory: directory, subpath: "." })).toBe(false);
  });

  test("a subpath written with a wildcard covers the paths it spans", () => {
    const directory = packageDirectoryDeclaring({
      name: "@fixture/spanned",
      exports: { ".": "./src/index.ts", "./tsconfig/*": "./tsconfig/*" },
    });

    expect(
      declaresPublicSubpath({ packageDirectory: directory, subpath: "./tsconfig/library.json" }),
    ).toBe(true);
  });

  test("a subpath of a different depth is not covered by a wildcard", () => {
    const directory = packageDirectoryDeclaring({
      name: "@fixture/spanned",
      exports: { ".": "./src/index.ts", "./tsconfig/*": "./tsconfig/*" },
    });

    expect(
      declaresPublicSubpath({ packageDirectory: directory, subpath: "./tsconfig/base/app.json" }),
    ).toBe(false);
  });

  test("a file under no manifest at all belongs to no package", () => {
    const { root } = parse(process.cwd());

    expect(owningPackageDirectoryOf(join(root, "never-written-here.ts"))).toBe(null);
  });

  test("a directory is not inside itself", () => {
    const directory = packageDirectoryHolding({});

    expect(isInsideDirectory({ path: directory, directory })).toBe(false);
  });
});
