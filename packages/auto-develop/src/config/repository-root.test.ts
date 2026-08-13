import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { resolveRepositoryRoot } from "./repository-root.ts";

describe("resolveRepositoryRoot", () => {
  const nestedGitDirRepositoryPath = join(tmpdir(), "auto-develop-nested-git-dir-repository");
  const gitFileRepositoryPath = join(tmpdir(), "auto-develop-git-file-repository");
  const plainDirectoryPath = join(tmpdir(), "auto-develop-plain-directory");

  const it = test
    .extend("repositoryRootFromNestedGitDir", () => {
      mkdirSync(join(nestedGitDirRepositoryPath, ".git"), { recursive: true });
      const nestedDirectory = join(nestedGitDirRepositoryPath, "packages", "deep");
      mkdirSync(nestedDirectory, { recursive: true });
      return resolveRepositoryRoot(nestedDirectory);
    })
    .extend("repositoryRootFromGitFile", () => {
      mkdirSync(gitFileRepositoryPath, { recursive: true });
      writeFileSync(join(gitFileRepositoryPath, ".git"), "gitdir: elsewhere\n");
      return resolveRepositoryRoot(gitFileRepositoryPath);
    })
    .extend("repositoryRootFromPlainDirectory", () => {
      mkdirSync(plainDirectoryPath, { recursive: true });
      return resolveRepositoryRoot(plainDirectoryPath);
    });

  it(".git ディレクトリを持つ最初の祖先を返す", ({ repositoryRootFromNestedGitDir }) => {
    expect(repositoryRootFromNestedGitDir).toBe(nestedGitDirRepositoryPath);
  });

  it(".git がファイルでも（worktree 形式）ルートとみなす", ({ repositoryRootFromGitFile }) => {
    expect(repositoryRootFromGitFile).toBe(gitFileRepositoryPath);
  });

  it("見つからなければ起動ディレクトリ自身を返す", ({ repositoryRootFromPlainDirectory }) => {
    expect(repositoryRootFromPlainDirectory).toBe(plainDirectoryPath);
  });
});
