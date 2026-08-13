import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

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

const HELD_SOURCE = "export const held = true;\n";

describe("foreignFilesIn", () => {
  describe("a file under a spec directory that is neither a spec nor test data", () => {
    const it = test.extend("foreignPathsBesideAPackageManifest", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
      mkdirSync(join(root, "packages", "alpha", "test"), { recursive: true });
      writeFileSync(join(root, "packages", "alpha", "package.json"), HELD_SOURCE, "utf8");
      writeFileSync(join(root, "packages", "alpha", "test", "helpers.ts"), HELD_SOURCE, "utf8");
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it("is found", ({ foreignPathsBesideAPackageManifest }) => {
      expect(foreignPathsBesideAPackageManifest).toStrictEqual(["packages/alpha/test/helpers.ts"]);
    });
  });

  describe("a spec and its test data under a spec directory", () => {
    const it = test.extend("foreignPathsBesideASpecAndItsAssets", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
      mkdirSync(join(root, "packages", "alpha", "test"), { recursive: true });
      writeFileSync(join(root, "packages", "alpha", "package.json"), HELD_SOURCE, "utf8");
      writeFileSync(join(root, "packages", "alpha", "test", "order.test.ts"), HELD_SOURCE, "utf8");
      writeFileSync(
        join(root, "packages", "alpha", "test", "order.assets.ts"),
        HELD_SOURCE,
        "utf8",
      );
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it("are left alone", ({ foreignPathsBesideASpecAndItsAssets }) => {
      expect(foreignPathsBesideASpecAndItsAssets).toStrictEqual([]);
    });
  });

  describe("a file outside every spec directory", () => {
    const it = test.extend("foreignPathsOutsideEverySpecDirectory", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
      mkdirSync(join(root, "packages", "alpha", "src"), { recursive: true });
      writeFileSync(join(root, "packages", "alpha", "package.json"), HELD_SOURCE, "utf8");
      writeFileSync(join(root, "packages", "alpha", "src", "order.ts"), HELD_SOURCE, "utf8");
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it("is left alone", ({ foreignPathsOutsideEverySpecDirectory }) => {
      expect(foreignPathsOutsideEverySpecDirectory).toStrictEqual([]);
    });
  });

  describe("a file nested under a directory inside a spec directory", () => {
    const it = test.extend("foreignPathsNestedInsideASpecDirectory", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
      mkdirSync(join(root, "packages", "alpha", "test", "orders"), { recursive: true });
      writeFileSync(join(root, "packages", "alpha", "package.json"), HELD_SOURCE, "utf8");
      writeFileSync(
        join(root, "packages", "alpha", "test", "orders", "held.ts"),
        HELD_SOURCE,
        "utf8",
      );
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get("packages/alpha") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it("is found as well", ({ foreignPathsNestedInsideASpecDirectory }) => {
      expect(foreignPathsNestedInsideASpecDirectory).toStrictEqual([
        "packages/alpha/test/orders/held.ts",
      ]);
    });
  });

  describe("a spec directory outside every package", () => {
    const it = test.extend("foreignPathsHeldByTheRepositoryRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
      mkdirSync(join(root, "test"), { recursive: true });
      writeFileSync(join(root, "test", "setup.ts"), HELD_SOURCE, "utf8");
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get(".") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it("is held by the repository root", ({ foreignPathsHeldByTheRepositoryRoot }) => {
      expect(foreignPathsHeldByTheRepositoryRoot).toStrictEqual(["test/setup.ts"]);
    });
  });

  describe("the report for a file nested under a spec directory outside every package", () => {
    const it = test.extend("reportsHeldByTheRepositoryRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
      mkdirSync(join(root, "test", "orders"), { recursive: true });
      writeFileSync(join(root, "test", "orders", "held.ts"), HELD_SOURCE, "utf8");
      return foreignFilesIn({
        repositoryRoot: root,
        convention: CONVENTION,
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      }).get(".");
    });

    it("names the spec directory the file sits in and the spellings it may carry", ({
      reportsHeldByTheRepositoryRoot,
    }) => {
      expect(reportsHeldByTheRepositoryRoot).toStrictEqual([
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
  });

  describe("a repository asked again after a later file appeared", () => {
    const it = test.extend("foreignPathsWalkedAfterALaterFileAppeared", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
      writeFileSync(join(root, "package.json"), '{ "name": "fixture" }\n', "utf8");
      mkdirSync(join(root, "test"), { recursive: true });
      writeFileSync(join(root, "test", "setup.ts"), HELD_SOURCE, "utf8");
      foreignFilesIn({
        repositoryRoot: root,
        convention: CONVENTION,
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
      writeFileSync(join(root, "test", "later.ts"), HELD_SOURCE, "utf8");
      return (
        foreignFilesIn({
          repositoryRoot: root,
          convention: CONVENTION,
          unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
        }).get(".") ?? []
      ).map((foreign) => foreign.data.foreignPath);
    });

    it("is answered from what was walked once", ({ foreignPathsWalkedAfterALaterFileAppeared }) => {
      expect(foreignPathsWalkedAfterALaterFileAppeared).toStrictEqual(["test/setup.ts"]);
    });
  });
});

describe("holdingWorkspaceOf", () => {
  describe("a path under a tree that declares no package at all", () => {
    const it = test.extend("workspaceHoldingAPathUnderNoPackage", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "spec-directory-contents-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(dirname(join(root, "test", "setup.ts")), { recursive: true });
      return holdingWorkspaceOf({ repositoryRoot: root, relativePath: "test/setup.ts" });
    });

    it("is held by the repository root", ({ workspaceHoldingAPathUnderNoPackage }) => {
      expect(workspaceHoldingAPathUnderNoPackage).toBe(".");
    });
  });
});
