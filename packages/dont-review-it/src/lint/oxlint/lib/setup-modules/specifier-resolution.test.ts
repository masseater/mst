import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { buildSetupExportSpecifierIndex } from "./export-specifier-index.ts";
import {
  packageDirectoryInWorkspace,
  packageReferenceOf,
  resolveCoupling,
} from "./specifier-resolution.ts";

const createdDirectory = (stem: string): string => {
  const path = mkdtempSync(join(tmpdir(), stem));
  onTestFinished(() => {
    rmSync(path, { recursive: true, force: true });
  });
  return path;
};

const installedUnder = ({
  workspaceRoot,
  name,
  directory,
}: {
  readonly workspaceRoot: string;
  readonly name: string;
  readonly directory: string;
}): void => {
  const link = join(workspaceRoot, "node_modules", name);
  mkdirSync(join(link, ".."), { recursive: true });
  symlinkSync(directory, link, "dir");
};

describe("setup-modules/specifier-resolution", () => {
  test("a scope written without a package name references no package", () => {
    expect(packageReferenceOf("@fixture")).toBe(null);
  });

  test("a package written with a subpath references that subpath", () => {
    expect(packageReferenceOf("@fixture/shared/http")).toStrictEqual({
      name: "@fixture/shared",
      subpath: "./http",
    });
  });

  test("a specifier naming no package resolves to no package directory", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");

    expect(
      packageDirectoryInWorkspace({
        specifier: "@fixture",
        fromFile: join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      }),
    ).toBe(null);
  });

  test("a package installed as a copy of its own is outside the workspace source", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    const installed = join(workspaceRoot, "node_modules", "vendored");
    mkdirSync(installed, { recursive: true });
    writeFileSync(join(installed, "package.json"), '{"name":"vendored"}');

    expect(
      packageDirectoryInWorkspace({
        specifier: "vendored",
        fromFile: join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      }),
    ).toBe(null);
  });

  test("a package linked from outside the workspace is not read as workspace source", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    const outside = createdDirectory("setup-modules-specifier-outside-");
    writeFileSync(join(outside, "package.json"), '{"name":"outsider"}');
    installedUnder({ workspaceRoot, name: "outsider", directory: outside });

    expect(
      packageDirectoryInWorkspace({
        specifier: "outsider",
        fromFile: join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      }),
    ).toBe(null);
  });

  test("a specifier written as an absolute path is left unresolved", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    const held = join(workspaceRoot, "held.ts");
    writeFileSync(held, "export const held = 1;\n");

    expect(
      resolveCoupling({
        specifier: held,
        fromFile: join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      }),
    ).toBe(null);
  });

  test("a relative specifier written without an extension resolves to the module beside it", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    writeFileSync(join(workspaceRoot, "held.ts"), "export const held = 1;\n");

    expect(
      resolveCoupling({
        specifier: "./held",
        fromFile: join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      }),
    ).toStrictEqual({ kind: "repositoryFile", path: join(workspaceRoot, "held.ts") });
  });

  test("a relative specifier written with a built extension resolves to the source beside it", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    writeFileSync(join(workspaceRoot, "held.ts"), "export const held = 1;\n");

    expect(
      resolveCoupling({
        specifier: "./held.js",
        fromFile: join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      }),
    ).toStrictEqual({ kind: "repositoryFile", path: join(workspaceRoot, "held.ts") });
  });

  test("a relative specifier naming a directory resolves to the index inside it", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    mkdirSync(join(workspaceRoot, "held"));
    writeFileSync(join(workspaceRoot, "held", "index.ts"), "export const held = 1;\n");

    expect(
      resolveCoupling({
        specifier: "./held",
        fromFile: join(workspaceRoot, "spec.test.ts"),
        workspaceRoot,
      }),
    ).toStrictEqual({ kind: "repositoryFile", path: join(workspaceRoot, "held", "index.ts") });
  });

  test("a workspace package export indexes the files reachable through re-exports", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    const packageDirectory = join(workspaceRoot, "shared");
    mkdirSync(join(packageDirectory, "src", "nested"), { recursive: true });
    writeFileSync(
      join(packageDirectory, "package.json"),
      JSON.stringify({
        name: "@fixture/shared",
        exports: {
          ".": {
            types: "./src/index.d.ts",
            import: "./src/index.ts",
            require: ["../outside.cjs", "./src/index.ts"],
          },
          "./package.json": "./package.json",
        },
      }),
    );
    writeFileSync(
      join(packageDirectory, "src", "index.ts"),
      'export * from "./nested/one";\nexport * from "external";\n',
    );
    writeFileSync(
      join(packageDirectory, "src", "nested", "one.ts"),
      'export { value } from "./two.mjs";\n',
    );
    writeFileSync(
      join(packageDirectory, "src", "nested", "two.mts"),
      'export * from "../index.ts";\n',
    );
    expect([...buildSetupExportSpecifierIndex(packageDirectory)]).toStrictEqual([
      [join(packageDirectory, "src", "index.ts"), "@fixture/shared"],
      [join(packageDirectory, "src", "nested", "one.ts"), "@fixture/shared"],
      [join(packageDirectory, "src", "nested", "two.mts"), "@fixture/shared"],
    ]);
  });

  test("an invalid package manifest contributes no exported repository files", () => {
    const workspaceRoot = createdDirectory("setup-modules-specifier-workspace-");
    const packageDirectory = join(workspaceRoot, "shared");
    mkdirSync(packageDirectory, { recursive: true });
    writeFileSync(join(packageDirectory, "package.json"), "{}");
    expect([...buildSetupExportSpecifierIndex(packageDirectory)]).toStrictEqual([]);
  });
});
