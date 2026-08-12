import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildExportSpecifierIndex } from "./export-specifier-index.ts";

describe("buildExportSpecifierIndex", () => {
  const packageWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, source] of Object.entries(files)) {
      const absolutePath = join(root, path);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source, "utf8");
    }
    return root;
  };

  const manifest = (fields: Readonly<Record<string, unknown>>): string => JSON.stringify(fields);

  const specifiersIn = (root: string): readonly (readonly [string, string])[] =>
    [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
      file.slice(root.length + 1),
      specifier,
    ]);

  test("a package that names its root export reaches the file behind it", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: { ".": "./src/index.ts" } }),
      "src/index.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root)).toStrictEqual([["src/index.ts", "@mst/user"]]);
  });

  test("a subpath export carries the specifier that names it", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: { "./plugin": "./src/plugin.ts" } }),
      "src/plugin.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root)).toStrictEqual([["src/plugin.ts", "@mst/user/plugin"]]);
  });

  test("a re-export chain carries the specifier to every file it reaches", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: "./src/index.ts" }),
      "src/index.ts": 'export * from "./status.ts";\nexport type { Draft } from "./draft.js";\n',
      "src/status.ts": 'export { STATUSES } from "./vocabulary/index.ts";\n',
      "src/draft.ts": "export type Draft = { readonly id: string };\n",
      "src/vocabulary/index.ts": 'export const STATUSES = ["draft"];\n',
    });

    expect(specifiersIn(root).map(([file]) => file)).toStrictEqual([
      "src/index.ts",
      "src/status.ts",
      "src/vocabulary/index.ts",
      "src/draft.ts",
    ]);
  });

  test("a re-export that names a file which is not there reaches nothing further", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: "./src/index.ts" }),
      "src/index.ts": 'export * from "./missing.ts";\nexport * from "node:path";\n',
    });

    expect(specifiersIn(root)).toStrictEqual([["src/index.ts", "@mst/user"]]);
  });

  test("a file re-exported from two places keeps the specifier that reached it first", () => {
    const root = packageWith({
      "package.json": manifest({
        name: "@mst/user",
        exports: { ".": "./src/index.ts", "./plugin": "./src/plugin.ts" },
      }),
      "src/index.ts": 'export * from "./shared.ts";\n',
      "src/plugin.ts": 'export * from "./shared.ts";\n',
      "src/shared.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root)).toStrictEqual([
      ["src/index.ts", "@mst/user"],
      ["src/shared.ts", "@mst/user"],
      ["src/plugin.ts", "@mst/user/plugin"],
    ]);
  });

  test("an export map that names conditions reaches the file each of them names", () => {
    const root = packageWith({
      "package.json": manifest({
        name: "@mst/user",
        exports: {
          ".": { types: "./src/index.d.ts", import: "./src/index.ts", require: "./src/index.ts" },
          "./package.json": "./package.json",
        },
      }),
      "src/index.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root)).toStrictEqual([["src/index.ts", "@mst/user"]]);
  });

  test("a re-export cycle is walked once", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: "./src/index.ts" }),
      "src/index.ts": 'export * from "./status.ts";\n',
      "src/status.ts": 'export * from "./index.ts";\n',
    });

    expect(specifiersIn(root).map(([file]) => file)).toStrictEqual([
      "src/index.ts",
      "src/status.ts",
    ]);
  });

  test("a re-export chain deeper than the limit stops there", () => {
    const step = (reachedNext: string): string => `export * from "./${reachedNext}.ts";\n`;
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: "./src/a.ts" }),
      "src/a.ts": step("b"),
      "src/b.ts": step("c"),
      "src/c.ts": step("d"),
      "src/d.ts": step("e"),
      "src/e.ts": step("f"),
      "src/f.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root).map(([file]) => file)).toStrictEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
      "src/d.ts",
      "src/e.ts",
    ]);
  });

  test("an entry file the manifest names but the package does not hold reaches only itself", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: "./src/missing.ts" }),
    });

    expect(specifiersIn(root)).toStrictEqual([["src/missing.ts", "@mst/user"]]);
  });

  test("two conditions that name different files both stand behind the subpath", () => {
    const root = packageWith({
      "package.json": manifest({
        name: "@mst/user",
        exports: { ".": { import: "./src/modern.ts", require: "./src/legacy.ts" } },
      }),
      "src/modern.ts": "export const total = 1;\n",
      "src/legacy.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root).map(([file]) => file)).toStrictEqual([
      "src/modern.ts",
      "src/legacy.ts",
    ]);
  });

  test("an export target that does not start with a relative marker is left out", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: { ".": "src/index.ts" } }),
      "src/index.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root)).toStrictEqual([]);
  });

  test("an export map nested deeper than the limit is not followed", () => {
    const root = packageWith({
      "package.json": manifest({
        name: "@mst/user",
        exports: {
          ".": { a: { b: { c: { d: { e: { f: { g: { h: { i: "./src/index.ts" } } } } } } } } },
        },
      }),
      "src/index.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root)).toStrictEqual([]);
  });

  test("an export map holding a list is not read as conditions", () => {
    const root = packageWith({
      "package.json": manifest({ name: "@mst/user", exports: { ".": ["./src/index.ts"] } }),
      "src/index.ts": "export const total = 1;\n",
    });

    expect(specifiersIn(root)).toStrictEqual([]);
  });

  test("a package that names no export surface reaches nothing", () => {
    const root = packageWith({ "package.json": manifest({ name: "@mst/user" }) });

    expect(specifiersIn(root)).toStrictEqual([]);
  });

  test("a directory that holds no manifest reaches nothing", () => {
    expect(
      specifiersIn(packageWith({ "src/index.ts": "export const total = 1;\n" })),
    ).toStrictEqual([]);
  });

  test("a manifest that names no package reaches nothing", () => {
    const root = packageWith({ "package.json": manifest({ exports: "./src/index.ts" }) });

    expect(specifiersIn(root)).toStrictEqual([]);
  });

  test("a manifest whose name is empty reaches nothing", () => {
    const root = packageWith({ "package.json": manifest({ name: "", exports: "./src/index.ts" }) });

    expect(specifiersIn(root)).toStrictEqual([]);
  });

  test("a manifest that is not an object reaches nothing", () => {
    const root = packageWith({ "package.json": '"@mst/user"' });

    expect(specifiersIn(root)).toStrictEqual([]);
  });
});
