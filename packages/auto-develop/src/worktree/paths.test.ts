import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  isManagedWorktreePath,
  prNumberFromDirectoryName,
  worktreePathFor,
  worktreeRoot,
} from "./paths.ts";

describe("worktreePathFor", () => {
  test("PR 番号から専用ルート直下の pr- 固定名パスを導く", () => {
    expect([basename(worktreePathFor(7)), dirname(worktreePathFor(7))]).toStrictEqual([
      "pr-7",
      worktreeRoot(),
    ]);
  });

  test("正の安全整数でない PR 番号は即座に拒否される", () => {
    expect(() => worktreePathFor(0)).toThrow("Invalid PR number for auto-develop worktree");
  });

  test("小数の PR 番号も拒否される", () => {
    expect(() => worktreePathFor(1.5)).toThrow("Invalid PR number for auto-develop worktree");
  });
});

describe("prNumberFromDirectoryName", () => {
  test("pr- に続く先頭ゼロなしの正整数だけを受ける", () => {
    expect([
      prNumberFromDirectoryName("pr-7"),
      prNumberFromDirectoryName("pr-0"),
      prNumberFromDirectoryName("not-pr"),
    ]).toStrictEqual([7, null, null]);
  });
});

describe("isManagedWorktreePath", () => {
  test("専用ルート直下の pr- ディレクトリだけを管理対象と認める", () => {
    expect(isManagedWorktreePath(join(worktreeRoot(), "pr-7"))).toStrictEqual(true);
  });

  test("専用ルート外のディレクトリは管理対象でない", () => {
    const strayDir = mkdtempSync(join(tmpdir(), "auto-develop-stray-"));
    expect(isManagedWorktreePath(join(strayDir, "pr-7"))).toStrictEqual(false);
  });

  test("専用ルート直下でも pr- 名でなければ管理対象でない", () => {
    expect(isManagedWorktreePath(join(worktreeRoot(), "system"))).toStrictEqual(false);
  });
});
