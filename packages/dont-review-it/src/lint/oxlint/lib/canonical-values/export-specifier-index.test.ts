import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { buildExportSpecifierIndex } from "./export-specifier-index.ts";

describe("buildExportSpecifierIndex", () => {
  describe("a package that names its root export", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { ".": "./src/index.ts" } }',
      );
      writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches the file behind it", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([["src/index.ts", "@mst/user"]]);
    });
  });

  describe("a subpath export", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { "./plugin": "./src/plugin.ts" } }',
      );
      writeFileSync(join(root, "src", "plugin.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("carries the specifier that names it", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([["src/plugin.ts", "@mst/user/plugin"]]);
    });
  });

  describe("a re-export chain", () => {
    const it = test.extend("files", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src", "vocabulary"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": "./src/index.ts" }',
      );
      writeFileSync(
        join(root, "src", "index.ts"),
        'export * from "./status.ts";\nexport type { Draft } from "./draft.js";\n',
      );
      writeFileSync(
        join(root, "src", "status.ts"),
        'export { STATUSES } from "./vocabulary/index.ts";\n',
      );
      writeFileSync(
        join(root, "src", "draft.ts"),
        "export type Draft = { readonly id: string };\n",
      );
      writeFileSync(
        join(root, "src", "vocabulary", "index.ts"),
        'export const STATUSES = ["draft"];\n',
      );
      return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
    });

    it("carries the specifier to every file it reaches", ({ files }) => {
      expect(files).toStrictEqual([
        "src/index.ts",
        "src/status.ts",
        "src/vocabulary/index.ts",
        "src/draft.ts",
      ]);
    });
  });

  describe("a re-export that names a file which is not there", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": "./src/index.ts" }',
      );
      writeFileSync(
        join(root, "src", "index.ts"),
        'export * from "./missing.ts";\nexport * from "node:path";\n',
      );
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches nothing further", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([["src/index.ts", "@mst/user"]]);
    });
  });

  describe("a file re-exported from two places", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { ".": "./src/index.ts", "./plugin": "./src/plugin.ts" } }',
      );
      writeFileSync(join(root, "src", "index.ts"), 'export * from "./shared.ts";\n');
      writeFileSync(join(root, "src", "plugin.ts"), 'export * from "./shared.ts";\n');
      writeFileSync(join(root, "src", "shared.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("keeps the specifier that reached it first", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([
        ["src/index.ts", "@mst/user"],
        ["src/shared.ts", "@mst/user"],
        ["src/plugin.ts", "@mst/user/plugin"],
      ]);
    });
  });

  describe("an export map that names conditions", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { ".": { "types": "./src/index.d.ts", "import": "./src/index.ts", "require": "./src/index.ts" }, "./package.json": "./package.json" } }',
      );
      writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches the file each of them names", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([["src/index.ts", "@mst/user"]]);
    });
  });

  describe("a re-export cycle", () => {
    const it = test.extend("files", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": "./src/index.ts" }',
      );
      writeFileSync(join(root, "src", "index.ts"), 'export * from "./status.ts";\n');
      writeFileSync(join(root, "src", "status.ts"), 'export * from "./index.ts";\n');
      return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
    });

    it("is walked once", ({ files }) => {
      expect(files).toStrictEqual(["src/index.ts", "src/status.ts"]);
    });
  });

  describe("a re-export chain deeper than the limit", () => {
    const it = test.extend("files", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "package.json"), '{ "name": "@mst/user", "exports": "./src/a.ts" }');
      writeFileSync(join(root, "src", "a.ts"), 'export * from "./b.ts";\n');
      writeFileSync(join(root, "src", "b.ts"), 'export * from "./c.ts";\n');
      writeFileSync(join(root, "src", "c.ts"), 'export * from "./d.ts";\n');
      writeFileSync(join(root, "src", "d.ts"), 'export * from "./e.ts";\n');
      writeFileSync(join(root, "src", "e.ts"), 'export * from "./f.ts";\n');
      writeFileSync(join(root, "src", "f.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
    });

    it("stops there", ({ files }) => {
      expect(files).toStrictEqual(["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"]);
    });
  });

  describe("an entry file the manifest names but the package does not hold", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": "./src/missing.ts" }',
      );
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches only itself", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([["src/missing.ts", "@mst/user"]]);
    });
  });

  describe("two conditions that name different files", () => {
    const it = test.extend("files", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { ".": { "import": "./src/modern.ts", "require": "./src/legacy.ts" } } }',
      );
      writeFileSync(join(root, "src", "modern.ts"), "export const total = 1;\n");
      writeFileSync(join(root, "src", "legacy.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file]) => file.slice(root.length + 1));
    });

    it("both stand behind the subpath", ({ files }) => {
      expect(files).toStrictEqual(["src/modern.ts", "src/legacy.ts"]);
    });
  });

  describe("an export target that does not start with a relative marker", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { ".": "src/index.ts" } }',
      );
      writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("is left out", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("an export map nested deeper than the limit", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { ".": { "a": { "b": { "c": { "d": { "e": { "f": { "g": { "h": { "i": "./src/index.ts" } } } } } } } } } } }',
      );
      writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("is not followed", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("an export map holding a list", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(
        join(root, "package.json"),
        '{ "name": "@mst/user", "exports": { ".": ["./src/index.ts"] } }',
      );
      writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("is not read as conditions", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("a package that names no export surface", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), '{ "name": "@mst/user" }');
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches nothing", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("a directory that holds no manifest", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "index.ts"), "export const total = 1;\n");
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches nothing", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("a manifest that names no package", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), '{ "exports": "./src/index.ts" }');
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches nothing", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("a manifest whose name is empty", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), '{ "name": "", "exports": "./src/index.ts" }');
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches nothing", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });

  describe("a manifest that is not an object", () => {
    const it = test.extend("specifiers", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "export-specifier-index-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "package.json"), '"@mst/user"');
      return [...buildExportSpecifierIndex(root)].map(([file, specifier]) => [
        file.slice(root.length + 1),
        specifier,
      ]);
    });

    it("reaches nothing", ({ specifiers }) => {
      expect(specifiers).toStrictEqual([]);
    });
  });
});
