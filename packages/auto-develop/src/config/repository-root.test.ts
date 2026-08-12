import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { resolveRepositoryRoot } from "./repository-root.ts";

const lookupFromNestedGitDir = (): {
  readonly resolvedRoot: string;
  readonly createdRoot: string;
} => {
  const createdRoot = mkdtempSync(join(tmpdir(), "auto-develop-root-"));
  mkdirSync(join(createdRoot, ".git"));
  const nested = join(createdRoot, "packages", "deep");
  mkdirSync(nested, { recursive: true });
  return { resolvedRoot: resolveRepositoryRoot(nested), createdRoot };
};

const lookupFromGitFile = (): { readonly resolvedRoot: string; readonly createdRoot: string } => {
  const createdRoot = mkdtempSync(join(tmpdir(), "auto-develop-root-"));
  writeFileSync(join(createdRoot, ".git"), "gitdir: elsewhere\n");
  return { resolvedRoot: resolveRepositoryRoot(createdRoot), createdRoot };
};

const lookupWithoutGit = (): { readonly resolvedRoot: string; readonly createdRoot: string } => {
  const createdRoot = mkdtempSync(join(tmpdir(), "auto-develop-plain-"));
  return { resolvedRoot: resolveRepositoryRoot(createdRoot), createdRoot };
};

const it = test
  .extend("nestedGitDirLookup", () => lookupFromNestedGitDir())
  .extend("gitFileLookup", () => lookupFromGitFile())
  .extend("plainDirLookup", () => lookupWithoutGit());

describe("resolveRepositoryRoot", () => {
  it(".git ディレクトリを持つ最初の祖先を返す", ({ nestedGitDirLookup }) => {
    expect(nestedGitDirLookup.resolvedRoot).toStrictEqual(nestedGitDirLookup.createdRoot);
  });

  it(".git がファイルでも（worktree 形式）ルートとみなす", ({ gitFileLookup }) => {
    expect(gitFileLookup.resolvedRoot).toStrictEqual(gitFileLookup.createdRoot);
  });

  it("見つからなければ起動ディレクトリ自身を返す", ({ plainDirLookup }) => {
    expect(plainDirLookup.resolvedRoot).toStrictEqual(plainDirLookup.createdRoot);
  });
});
