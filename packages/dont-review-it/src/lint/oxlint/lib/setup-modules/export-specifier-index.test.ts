import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildSetupExportSpecifierIndex } from "./export-specifier-index.ts";

const packageHolding = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "setup-export-index-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
};

describe("setup-modules/export-specifier-index", () => {
  test.each(["null", "[]", "{}", '{"name":""}'])(
    "an unusable package manifest indexes no source for %s",
    (manifest) => {
      const root = packageHolding({ "package.json": manifest });

      expect([...buildSetupExportSpecifierIndex(root)]).toStrictEqual([]);
    },
  );

  test("conditional and duplicate entry targets share one public specifier", () => {
    const root = packageHolding({
      "package.json": JSON.stringify({
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
      "src/index.ts": 'export * from "./nested";\nexport * from "external";\n',
      "src/nested/index.ts": 'export * from "../index.ts";\nexport * from "./missing";\n',
    });

    expect([...buildSetupExportSpecifierIndex(root)]).toStrictEqual([
      [join(root, "src/index.ts"), "fixture"],
      [join(root, "src/nested/index.ts"), "fixture"],
    ]);
  });

  test("re-export traversal stops at the configured depth", () => {
    const files: Readonly<Record<string, string>> = {
      "package.json": JSON.stringify({ name: "fixture", exports: "./src/zero.ts" }),
      "src/zero.ts": 'export * from "./1.ts";\n',
      "src/1.ts": 'export * from "./2.ts";\n',
      "src/2.ts": 'export * from "./3.ts";\n',
      "src/3.ts": 'export * from "./4.ts";\n',
      "src/4.ts": 'export * from "./5.ts";\n',
      "src/5.ts": 'export * from "./6.ts";\n',
    };
    const root = packageHolding(files);

    expect([...buildSetupExportSpecifierIndex(root)].map(([file]) => file)).toStrictEqual([
      join(root, "src/zero.ts"),
      join(root, "src/1.ts"),
      join(root, "src/2.ts"),
      join(root, "src/3.ts"),
      join(root, "src/4.ts"),
    ]);
  });

  test("an over-deep export condition contributes no source", () => {
    const nested = Array.from({ length: 12 }).reduce<unknown>(
      (value) => ({ default: value }),
      "./src/index.ts",
    );
    const root = packageHolding({
      "package.json": JSON.stringify({ name: "fixture", exports: nested }),
      "src/index.ts": "export const value = 1;\n",
    });

    expect([...buildSetupExportSpecifierIndex(root)]).toStrictEqual([]);
  });

  test("non-package targets and declarations index no source", () => {
    const root = packageHolding({
      "package.json": JSON.stringify({
        name: "fixture",
        exports: {
          ".": "../outside.ts",
          "./types": "./src/index.d.ts",
        },
      }),
      "src/index.d.ts": "export declare const value: number;\n",
    });

    expect([...buildSetupExportSpecifierIndex(root)]).toStrictEqual([]);
  });

  test("a named package without exports indexes no source", () => {
    const root = packageHolding({ "package.json": JSON.stringify({ name: "fixture" }) });

    expect([...buildSetupExportSpecifierIndex(root)]).toStrictEqual([]);
  });
});
