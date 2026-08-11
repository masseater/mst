import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { resolveRepositoryRoot } from "./repository-root.ts";

describe("resolveRepositoryRoot", () => {
  test(".git ディレクトリを持つ最初の祖先を返す", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "auto-develop-root-"));
    mkdirSync(join(repoRoot, ".git"));
    const nested = join(repoRoot, "packages", "deep");
    mkdirSync(nested, { recursive: true });
    expect(resolveRepositoryRoot(nested)).toStrictEqual(repoRoot);
  });

  test(".git がファイルでも（worktree 形式）ルートとみなす", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "auto-develop-root-"));
    writeFileSync(join(repoRoot, ".git"), "gitdir: elsewhere\n");
    expect(resolveRepositoryRoot(repoRoot)).toStrictEqual(repoRoot);
  });

  test("見つからなければ起動ディレクトリ自身を返す", () => {
    const plainDir = mkdtempSync(join(tmpdir(), "auto-develop-plain-"));
    expect(resolveRepositoryRoot(plainDir)).toStrictEqual(plainDir);
  });
});
