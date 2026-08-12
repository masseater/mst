import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { UNSCANNED_DIRECTORY_NAMES } from "../repository-scan/worktree-files.ts";
import { assetsNameMarkersFrom } from "../spec-syntax/assets-files.ts";
import { specDirectoryNamesFrom } from "../spec-syntax/spec-directories.ts";
import { DEFAULT_SPEC_FILE_SUFFIXES } from "../spec-syntax/spec-files.ts";
import { foreignFilesIn, holdingWorkspaceOf } from "./foreign-files.ts";

const CONVENTION = {
  specDirectoryNames: specDirectoryNamesFrom([]),
  specFileSuffixes: DEFAULT_SPEC_FILE_SUFFIXES,
  assetsNameMarkers: assetsNameMarkersFrom([]),
};

const createRepository = (): string => {
  const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
  return root;
};

const writeAt = ({
  root,
  relativePath,
}: {
  readonly root: string;
  readonly relativePath: string;
}): void => {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "export const held = true;\n", "utf8");
};

const foreignPathsIn = ({
  root,
  workspace,
}: {
  readonly root: string;
  readonly workspace: string;
}): readonly string[] =>
  (
    foreignFilesIn({
      repositoryRoot: root,
      convention: CONVENTION,
      unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
    }).get(workspace) ?? []
  ).map((foreign) => foreign.data.foreignPath);

describe("foreign-files", () => {
  test("a file that is neither a spec nor test data under a spec directory is found", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "packages/alpha/package.json" });
    writeAt({ root, relativePath: "packages/alpha/test/helpers.ts" });

    expect(foreignPathsIn({ root, workspace: "packages/alpha" })).toStrictEqual([
      "packages/alpha/test/helpers.ts",
    ]);
  });

  test("a spec and its test data under a spec directory are left alone", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "packages/alpha/package.json" });
    writeAt({ root, relativePath: "packages/alpha/test/order.test.ts" });
    writeAt({ root, relativePath: "packages/alpha/test/order.assets.ts" });

    expect(foreignPathsIn({ root, workspace: "packages/alpha" })).toStrictEqual([]);
  });

  test("a file outside every spec directory is left alone", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "packages/alpha/package.json" });
    writeAt({ root, relativePath: "packages/alpha/src/order.ts" });

    expect(foreignPathsIn({ root, workspace: "packages/alpha" })).toStrictEqual([]);
  });

  test("a file nested under a directory inside a spec directory is found as well", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "packages/alpha/package.json" });
    writeAt({ root, relativePath: "packages/alpha/test/orders/held.ts" });

    expect(foreignPathsIn({ root, workspace: "packages/alpha" })).toStrictEqual([
      "packages/alpha/test/orders/held.ts",
    ]);
  });

  test("a spec directory outside every package is held by the repository root", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "test/setup.ts" });

    expect(foreignPathsIn({ root, workspace: "." })).toStrictEqual(["test/setup.ts"]);
  });

  test("the message names the spec directory the file sits in and the spellings it may carry", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "test/orders/held.ts" });

    expect(
      foreignFilesIn({
        repositoryRoot: root,
        convention: CONVENTION,
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      }).get("."),
    ).toStrictEqual([
      {
        workspace: ".",
        messageId: "foreignFileInSpecDirectory",
        data: {
          specDirectory: "test",
          foreignPath: "test/orders/held.ts",
          specNames: "`*.test.ts`, `*.test.tsx`",
          assetsNames: "`*.assets.*`",
        },
      },
    ]);
  });

  test("the same repository is walked once and answered from what was walked", () => {
    const root = createRepository();
    writeAt({ root, relativePath: "test/setup.ts" });
    const walked = foreignPathsIn({ root, workspace: "." });
    writeAt({ root, relativePath: "test/later.ts" });

    expect(foreignPathsIn({ root, workspace: "." })).toStrictEqual(walked);
  });

  test("a path under a tree that declares no package at all is held by the repository root", () => {
    const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });

    expect(holdingWorkspaceOf({ repositoryRoot: root, relativePath: "test/setup.ts" })).toBe(".");
  });
});
