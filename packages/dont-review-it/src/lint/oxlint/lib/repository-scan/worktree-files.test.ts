import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  UNSCANNED_DIRECTORY_NAMES,
  unscannedDirectoryNamesFrom,
  worktreeFilePathsUnder,
} from "./worktree-files.ts";

const it = test
  .extend("pathsUnderPopulatedWorktree", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "packages", "alpha"), { recursive: true });
    writeFileSync(join(root, "packages", "alpha", "package.json"), "held\n", "utf8");
    writeFileSync(join(root, "README.md"), "held\n", "utf8");
    return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
  })
  .extend("pathsBesideUnscannedDirectories", ({}, { onCleanup }) => {
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
  })
  .extend("pathsBesideASymbolicLink", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    const target = join(root, "src", "entry.ts");
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, "held\n", "utf8");
    symlinkSync(target, join(root, "link.ts"));
    return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
  })
  .extend("pathsUnderAbsentRoot", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    return worktreeFilePathsUnder({
      root: join(root, "absent"),
      unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES,
    });
  })
  .extend("pathsWalkedAfterALaterFileAppeared", ({}, { onCleanup }) => {
    const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(join(root, "src"), { recursive: true });
    writeFileSync(join(root, "src", "entry.ts"), "held\n", "utf8");
    worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
    writeFileSync(join(root, "src", "later.ts"), "held\n", "utf8");
    return worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });
  })
  .extend("namesReadWithoutOptions", () => unscannedDirectoryNamesFrom([]))
  .extend("namesReadFromEmptyOptions", () => unscannedDirectoryNamesFrom([{}]))
  .extend("namesReadFromNamedDirectories", () =>
    unscannedDirectoryNamesFrom([{ unscannedDirectories: ["vendor"] }]),
  );

describe("worktreeFilePathsUnder", () => {
  it("every file under the root is listed as a repository relative path", ({
    pathsUnderPopulatedWorktree,
  }) => {
    expect(pathsUnderPopulatedWorktree).toStrictEqual(["README.md", "packages/alpha/package.json"]);
  });

  it("a directory named as unscanned is walked past", ({ pathsBesideUnscannedDirectories }) => {
    expect(pathsBesideUnscannedDirectories).toStrictEqual(["src/entry.ts"]);
  });

  it("an entry that is neither a file nor a directory is left out", ({
    pathsBesideASymbolicLink,
  }) => {
    expect(pathsBesideASymbolicLink).toStrictEqual(["src/entry.ts"]);
  });

  it("a root that does not exist holds no files", ({ pathsUnderAbsentRoot }) => {
    expect(pathsUnderAbsentRoot).toStrictEqual([]);
  });

  it("the same worktree is walked once and answered from what was walked", ({
    pathsWalkedAfterALaterFileAppeared,
  }) => {
    expect(pathsWalkedAfterALaterFileAppeared).toStrictEqual(["src/entry.ts"]);
  });
});

describe("unscannedDirectoryNamesFrom", () => {
  it("options nobody wrote leave the declared list standing", ({ namesReadWithoutOptions }) => {
    expect(namesReadWithoutOptions).toBe(UNSCANNED_DIRECTORY_NAMES);
  });

  it("options that name no unscanned directories leave the declared list standing", ({
    namesReadFromEmptyOptions,
  }) => {
    expect(namesReadFromEmptyOptions).toBe(UNSCANNED_DIRECTORY_NAMES);
  });

  it("options that name unscanned directories replace the declared list", ({
    namesReadFromNamedDirectories,
  }) => {
    expect(namesReadFromNamedDirectories).toStrictEqual(new Set(["vendor"]));
  });
});
