import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { buildSetupExportSpecifierIndex } from "./export-specifier-index.ts";

const SHARED_SPECIFIER_ROOT = join(tmpdir(), "setup-export-index-shared-specifier");

const DEPTH_LIMIT_ROOT = join(tmpdir(), "setup-export-index-depth-limit");

describe("setup-modules/export-specifier-index", () => {
  describe("a package manifest holding null", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      const packageRoot = mkdtempSync(join(tmpdir(), "setup-export-index-"));
      onCleanup(() => {
        rmSync(packageRoot, { recursive: true, force: true });
      });
      writeFileSync(join(packageRoot, "package.json"), "null", "utf8");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it("indexes no source", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(new Map<string, string>());
    });
  });

  describe("a package manifest holding an array", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      const packageRoot = mkdtempSync(join(tmpdir(), "setup-export-index-"));
      onCleanup(() => {
        rmSync(packageRoot, { recursive: true, force: true });
      });
      writeFileSync(join(packageRoot, "package.json"), "[]", "utf8");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it("indexes no source", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(new Map<string, string>());
    });
  });

  describe("a package manifest holding no name", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      const packageRoot = mkdtempSync(join(tmpdir(), "setup-export-index-"));
      onCleanup(() => {
        rmSync(packageRoot, { recursive: true, force: true });
      });
      writeFileSync(join(packageRoot, "package.json"), "{}", "utf8");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it("indexes no source", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(new Map<string, string>());
    });
  });

  describe("a package manifest holding an empty name", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      const packageRoot = mkdtempSync(join(tmpdir(), "setup-export-index-"));
      onCleanup(() => {
        rmSync(packageRoot, { recursive: true, force: true });
      });
      writeFileSync(join(packageRoot, "package.json"), '{"name":""}', "utf8");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it("indexes no source", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(new Map<string, string>());
    });
  });

  describe("conditional and duplicate entry targets reaching the same sources", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      rmSync(SHARED_SPECIFIER_ROOT, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(SHARED_SPECIFIER_ROOT, { recursive: true, force: true });
      });
      mkdirSync(join(SHARED_SPECIFIER_ROOT, "src/nested"), { recursive: true });
      writeFileSync(
        join(SHARED_SPECIFIER_ROOT, "package.json"),
        JSON.stringify({
          name: "fixture",
          exports: {
            ".": {
              types: "./src/index.d.ts",
              import: "./src/index.ts",
              require: "./src/index.ts",
            },
            "./alias": "./src/index.ts",
            "./package.json": "./package.json",
            "./ignored": [null, 1, ["./src/ignored.ts"]],
          },
        }),
        "utf8",
      );
      writeFileSync(
        join(SHARED_SPECIFIER_ROOT, "src/index.ts"),
        'export * from "./nested";\nexport * from "external";\n',
        "utf8",
      );
      writeFileSync(
        join(SHARED_SPECIFIER_ROOT, "src/nested/index.ts"),
        'export * from "../index.ts";\nexport * from "./missing";\n',
        "utf8",
      );
      return buildSetupExportSpecifierIndex(SHARED_SPECIFIER_ROOT);
    });

    it("share one public specifier", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(
        new Map<string, string>([
          [join(SHARED_SPECIFIER_ROOT, "src/index.ts"), "fixture"],
          [join(SHARED_SPECIFIER_ROOT, "src/nested/index.ts"), "fixture"],
        ]),
      );
    });
  });

  describe("an entry re-exporting through a chain deeper than the traversal allows", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      rmSync(DEPTH_LIMIT_ROOT, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(DEPTH_LIMIT_ROOT, { recursive: true, force: true });
      });
      mkdirSync(join(DEPTH_LIMIT_ROOT, "src"), { recursive: true });
      writeFileSync(
        join(DEPTH_LIMIT_ROOT, "package.json"),
        JSON.stringify({ name: "fixture", exports: "./src/zero.ts" }),
        "utf8",
      );
      writeFileSync(join(DEPTH_LIMIT_ROOT, "src/zero.ts"), 'export * from "./1.ts";\n', "utf8");
      writeFileSync(join(DEPTH_LIMIT_ROOT, "src/1.ts"), 'export * from "./2.ts";\n', "utf8");
      writeFileSync(join(DEPTH_LIMIT_ROOT, "src/2.ts"), 'export * from "./3.ts";\n', "utf8");
      writeFileSync(join(DEPTH_LIMIT_ROOT, "src/3.ts"), 'export * from "./4.ts";\n', "utf8");
      writeFileSync(join(DEPTH_LIMIT_ROOT, "src/4.ts"), 'export * from "./5.ts";\n', "utf8");
      writeFileSync(join(DEPTH_LIMIT_ROOT, "src/5.ts"), 'export * from "./6.ts";\n', "utf8");
      return buildSetupExportSpecifierIndex(DEPTH_LIMIT_ROOT);
    });

    it("stops at the configured depth", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(
        new Map<string, string>([
          [join(DEPTH_LIMIT_ROOT, "src/zero.ts"), "fixture"],
          [join(DEPTH_LIMIT_ROOT, "src/1.ts"), "fixture"],
          [join(DEPTH_LIMIT_ROOT, "src/2.ts"), "fixture"],
          [join(DEPTH_LIMIT_ROOT, "src/3.ts"), "fixture"],
          [join(DEPTH_LIMIT_ROOT, "src/4.ts"), "fixture"],
        ]),
      );
    });
  });

  describe("an export condition nested deeper than the condition limit", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      const packageRoot = mkdtempSync(join(tmpdir(), "setup-export-index-"));
      onCleanup(() => {
        rmSync(packageRoot, { recursive: true, force: true });
      });
      const overDeepExports = Array.from({ length: 12 }).reduce<unknown>(
        (nestedTarget) => ({ default: nestedTarget }),
        "./src/index.ts",
      );
      mkdirSync(join(packageRoot, "src"), { recursive: true });
      writeFileSync(
        join(packageRoot, "package.json"),
        JSON.stringify({ name: "fixture", exports: overDeepExports }),
        "utf8",
      );
      writeFileSync(join(packageRoot, "src/index.ts"), "export const total = 1;\n", "utf8");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it("contributes no source", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(new Map<string, string>());
    });
  });

  describe("entry targets pointing outside the package and at declarations", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      const packageRoot = mkdtempSync(join(tmpdir(), "setup-export-index-"));
      onCleanup(() => {
        rmSync(packageRoot, { recursive: true, force: true });
      });
      mkdirSync(join(packageRoot, "src"), { recursive: true });
      writeFileSync(
        join(packageRoot, "package.json"),
        JSON.stringify({
          name: "fixture",
          exports: { ".": "../outside.ts", "./types": "./src/index.d.ts" },
        }),
        "utf8",
      );
      writeFileSync(
        join(packageRoot, "src/index.d.ts"),
        "export declare const total: number;\n",
        "utf8",
      );
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it("index no source", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(new Map<string, string>());
    });
  });

  describe("a named package declaring no exports", () => {
    const it = test.extend("specifierIndex", ({}, { onCleanup }) => {
      const packageRoot = mkdtempSync(join(tmpdir(), "setup-export-index-"));
      onCleanup(() => {
        rmSync(packageRoot, { recursive: true, force: true });
      });
      writeFileSync(join(packageRoot, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
      return buildSetupExportSpecifierIndex(packageRoot);
    });

    it("indexes no source", ({ specifierIndex }) => {
      expect(specifierIndex).toStrictEqual(new Map<string, string>());
    });
  });
});
