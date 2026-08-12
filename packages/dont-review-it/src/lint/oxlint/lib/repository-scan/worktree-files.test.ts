import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import {
  UNSCANNED_DIRECTORY_NAMES,
  unscannedDirectoryNamesFrom,
  worktreeFilePathsUnder,
} from "./worktree-files.ts";

const createWorktree = (): string => {
  const root = mkdtempSync(join(tmpdir(), "worktree-files-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const writeAt = ({
  root,
  relativePath,
}: {
  readonly root: string;
  readonly relativePath: string;
}): string => {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "held\n", "utf8");
  return path;
};

const scan = (root: string): readonly string[] =>
  worktreeFilePathsUnder({ root, unscannedDirectoryNames: UNSCANNED_DIRECTORY_NAMES });

describe("worktree-files", () => {
  test("every file under the root is listed as a repository relative path", () => {
    const root = createWorktree();
    writeAt({ root, relativePath: "packages/alpha/package.json" });
    writeAt({ root, relativePath: "README.md" });

    expect(scan(root)).toStrictEqual(["README.md", "packages/alpha/package.json"]);
  });

  test("a directory named as unscanned is walked past", () => {
    const root = createWorktree();
    writeAt({ root, relativePath: "node_modules/left-pad/index.js" });
    writeAt({ root, relativePath: "dist/bundle.js" });
    writeAt({ root, relativePath: "src/entry.ts" });

    expect(scan(root)).toStrictEqual(["src/entry.ts"]);
  });

  test("an entry that is neither a file nor a directory is left out", () => {
    const root = createWorktree();
    const checked = writeAt({ root, relativePath: "src/entry.ts" });
    symlinkSync(checked, join(root, "link.ts"));

    expect(scan(root)).toStrictEqual(["src/entry.ts"]);
  });

  test("a root that does not exist holds no files", () => {
    const root = createWorktree();

    expect(scan(join(root, "absent"))).toStrictEqual([]);
  });

  test("the same worktree is walked once and answered from what was walked", () => {
    const root = createWorktree();
    writeAt({ root, relativePath: "src/entry.ts" });
    const walked = scan(root);
    writeAt({ root, relativePath: "src/later.ts" });

    expect(scan(root)).toStrictEqual(walked);
  });

  test("options that name no unscanned directories leave the declared list standing", () => {
    expect(unscannedDirectoryNamesFrom([])).toBe(UNSCANNED_DIRECTORY_NAMES);
    expect(unscannedDirectoryNamesFrom([{}])).toBe(UNSCANNED_DIRECTORY_NAMES);
  });

  test("options that name unscanned directories replace the declared list", () => {
    expect(unscannedDirectoryNamesFrom([{ unscannedDirectories: ["vendor"] }])).toStrictEqual(
      new Set(["vendor"]),
    );
  });
});
