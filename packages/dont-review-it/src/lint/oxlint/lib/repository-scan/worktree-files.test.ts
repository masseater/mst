import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  UNSCANNED_DIRECTORY_NAMES,
  unscannedDirectoryNamesFrom,
  worktreeFilePathsUnder,
} from "./worktree-files.ts";

describe("worktreeFilePathsUnder", () => {
  describe("a worktree holding files at the root and under nested directories", () => {
    const it = test.extend("paths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages", "alpha"), { recursive: true });
      writeFileSync(join(root, "packages", "alpha", "package.json"), "held\n", "utf8");
      writeFileSync(join(root, "README.md"), "held\n", "utf8");
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it("lists every file as a repository relative path", ({ paths }) => {
      expect(paths).toStrictEqual(["README.md", "packages/alpha/package.json"]);
    });
  });

  describe("a worktree holding directories named as unscanned", () => {
    const it = test.extend("paths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "node_modules", "left-pad"), { recursive: true });
      writeFileSync(join(root, "node_modules", "left-pad", "index.js"), "held\n", "utf8");
      mkdirSync(join(root, "dist"), { recursive: true });
      writeFileSync(join(root, "dist", "bundle.js"), "held\n", "utf8");
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "entry.ts"), "held\n", "utf8");
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it("walks past each of them and keeps what stands beside them", ({ paths }) => {
      expect(paths).toStrictEqual(["src/entry.ts"]);
    });
  });

  describe("a worktree holding a symbolic link beside a file", () => {
    const it = test.extend("paths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      const target = join(root, "src", "entry.ts");
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, "held\n", "utf8");
      symlinkSync(target, join(root, "link.ts"));
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it("leaves out the entry that is neither a file nor a directory", ({ paths }) => {
      expect(paths).toStrictEqual(["src/entry.ts"]);
    });
  });

  describe("a root that does not exist", () => {
    const it = test.extend("paths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      return worktreeFilePathsUnder({
        root: join(root, "absent"),
        unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
      });
    });

    it("holds no files", ({ paths }) => {
      expect(paths).toStrictEqual([]);
    });
  });

  describe("a worktree asked again after a later file appeared", () => {
    const it = test.extend("paths", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src", "entry.ts"), "held\n", "utf8");
      worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
      writeFileSync(join(root, "src", "later.ts"), "held\n", "utf8");
      return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    });

    it("is walked once and answered from what was walked", ({ paths }) => {
      expect(paths).toStrictEqual(["src/entry.ts"]);
    });
  });
});

describe("unscannedDirectoryNamesFrom", () => {
  describe("options nobody wrote", () => {
    const it = test.extend("names", () => unscannedDirectoryNamesFrom([]));

    it("leaves the declared list standing", ({ names }) => {
      expect(names).toBe(UNSCANNED_DIRECTORY_NAMES);
    });
  });

  describe("options that name no unscanned directories", () => {
    const it = test.extend("names", () => unscannedDirectoryNamesFrom([{}]));

    it("leaves the declared list standing", ({ names }) => {
      expect(names).toBe(UNSCANNED_DIRECTORY_NAMES);
    });
  });

  describe("options that name unscanned directories", () => {
    const it = test.extend("names", () =>
      unscannedDirectoryNamesFrom([{ unscannedDirectories: ["vendor"] }]));

    it("replaces the declared list", ({ names }) => {
      expect(names).toStrictEqual(new Set(["vendor"]));
    });
  });
});
