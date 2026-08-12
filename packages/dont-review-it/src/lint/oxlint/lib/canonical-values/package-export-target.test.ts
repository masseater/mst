import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import {
  packageExportPatternCaptures,
  packageExportSourceFile,
  packageExportTargetPatterns,
  singleWildcardPattern,
  substitutePackageExportPattern,
  validPackageExportTargetPattern,
  winningPackageExportSubpath,
} from "./package-export-target.ts";

const repository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "package-export-target-"));
  onTestFinished(() => {
    rmSync(root, { force: true, recursive: true });
  });
  return root;
};

const write = (path: string, contents = "export {};\n"): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
};

describe("package export targets", () => {
  test("source targets resolve JavaScript spellings, extensionless files, and indexes", () => {
    const root = repository();
    write(join(root, "src/value.ts"));
    write(join(root, "src/view.tsx"));
    write(join(root, "src/module.mts"));
    write(join(root, "src/common.cts"));
    write(join(root, "src/exact.json"), "{}\n");
    write(join(root, "src/directory/index.ts"));

    expect(packageExportSourceFile(root, "./src/value.js")).toBe(join(root, "src/value.ts"));
    expect(packageExportSourceFile(root, "./src/view.jsx")).toBe(join(root, "src/view.tsx"));
    expect(packageExportSourceFile(root, "./src/module.mjs")).toBe(join(root, "src/module.mts"));
    expect(packageExportSourceFile(root, "./src/common.cjs")).toBe(join(root, "src/common.cts"));
    expect(packageExportSourceFile(root, "./src/exact.json")).toBe(join(root, "src/exact.json"));
    expect(packageExportSourceFile(root, "./src/directory")).toBe(
      join(root, "src/directory/index.ts"),
    );
    expect(packageExportSourceFile(root, "./src/missing")).toBeNull();
  });

  test("single wildcard parsing rejects missing and repeated wildcards", () => {
    expect(singleWildcardPattern("./src/*.ts")).toStrictEqual({ prefix: "./src/", suffix: ".ts" });
    expect(singleWildcardPattern("./src/value.ts")).toBeNull();
    expect(singleWildcardPattern("./src/**.ts")).toBeNull();
  });

  test("subpath selection follows exact and Node pattern precedence", () => {
    const patterns = ["./*", "./private/*", "./private/*.ts", "./exact"];
    expect(winningPackageExportSubpath(patterns, "./exact")).toBe("./exact");
    expect(winningPackageExportSubpath(patterns, "./private/status.ts")).toBe("./private/*.ts");
    expect(winningPackageExportSubpath(["./private/*", "./*"], "./private/status")).toBe(
      "./private/*",
    );
    expect(winningPackageExportSubpath(["./*", "./*.ts"], "./status.ts")).toBe("./*.ts");
    expect(winningPackageExportSubpath(["./*"], "./nested/status")).toBe("./*");
    expect(winningPackageExportSubpath(["./*.ts"], "./status.js")).toBeNull();
    expect(winningPackageExportSubpath(["./?", "./*"], "./status")).toBe("./*");
    expect(winningPackageExportSubpath(["./*suffix", "./*"], "./statussuffix")).toBe("./*suffix");
    expect(winningPackageExportSubpath(["./*", "./*"], "./status")).toBe("./*");
  });

  test("conditional target patterns distinguish runtime and type-only targets", () => {
    const target = {
      types: "./types/index.d.ts",
      import: ["./src/index.js", null],
      default: "./src/fallback.js",
    };
    expect(
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: target }),
    ).toStrictEqual(["./types/index.d.ts", "./src/index.js", "./src/fallback.js"]);
    expect(
      packageExportTargetPatterns({ depth: 0, includeTypes: false, value: target }),
    ).toStrictEqual(["./src/index.js", "./src/fallback.js"]);
    expect(
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: null }),
    ).toStrictEqual([]);
    expect(packageExportTargetPatterns({ depth: 0, includeTypes: true, value: 1 })).toBeNull();
    expect(packageExportTargetPatterns({ depth: 9, includeTypes: true, value: {} })).toBeNull();
    expect(packageExportTargetPatterns({ depth: 0, includeTypes: true, value: [1] })).toBeNull();
    expect(
      packageExportTargetPatterns({ depth: 9, includeTypes: true, value: ["./src/index.js"] }),
    ).toBeNull();
    expect(
      packageExportTargetPatterns({ depth: 8, includeTypes: true, value: { import: 1 } }),
    ).toBeNull();
  });

  test("target patterns must stay inside a package and contain one wildcard", () => {
    const root = repository();
    expect(validPackageExportTargetPattern(root, "./src/*.ts")).toBe(true);
    expect(validPackageExportTargetPattern(root, "./src/value.ts")).toBe(false);
    expect(validPackageExportTargetPattern(root, "../shared/*.ts")).toBe(false);
  });

  test("pattern captures are derived from repository files once and sorted", () => {
    const root = repository();
    const owner = join(root, "src/public/owner.ts");
    const status = join(root, "src/public/status.ts");
    expect(
      packageExportPatternCaptures({
        packageDirectory: root,
        repositoryFiles: [status, owner, owner, join(root, "src/private/value.ts")],
        targets: ["./src/public/*.js", "./src/public/*.ts"],
      }),
    ).toStrictEqual(["owner", "status"]);
    expect(
      packageExportPatternCaptures({
        packageDirectory: root,
        repositoryFiles: [join(root, "src/public/.ts")],
        targets: ["./src/public/*.ts"],
      }),
    ).toStrictEqual([]);
    expect(
      packageExportPatternCaptures({
        packageDirectory: root,
        repositoryFiles: [join(root, "src/public/status.ts")],
        targets: ["./src/public/value.ts"],
      }),
    ).toStrictEqual([]);
    expect(
      packageExportPatternCaptures({
        packageDirectory: root,
        repositoryFiles: [join(root, "src/public/status*.ts")],
        targets: ["./src/public/*.ts"],
      }),
    ).toStrictEqual([]);
  });

  test("pattern substitution preserves arrays, conditions, null, and primitive values", () => {
    expect(
      substitutePackageExportPattern({ import: ["./src/*.js", null], default: 1 }, "status"),
    ).toStrictEqual({ import: ["./src/status.js", null], default: 1 });
  });
});
