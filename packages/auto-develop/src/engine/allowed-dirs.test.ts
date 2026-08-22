import { describe, expect, test } from "vite-plus/test";

import { normalizeAllowedDirs } from "./allowed-dirs.ts";

describe("normalizeAllowedDirs", () => {
  describe("リポジトリルートが cwd と異なる", () => {
    const it = test.extend("dirsForDistinctRoot", () =>
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "/repo", sharedGitDir: "/repo/.git" }));

    it("リポジトリルートと共通ディレクトリをこの順で並べる", ({ dirsForDistinctRoot }) => {
      expect(dirsForDistinctRoot).toStrictEqual(["/repo", "/repo/.git"]);
    });
  });

  describe("リポジトリルートが cwd と同一である", () => {
    const it = test.extend("dirsForRootEqualToCwd", () =>
      normalizeAllowedDirs({
        cwd: "/work/pr-1",
        repoRoot: "/work/pr-1",
        sharedGitDir: "/repo/.git/worktrees/pr-1",
      }));

    it("ルートが cwd と同一なら除外され共通ディレクトリだけになる", ({ dirsForRootEqualToCwd }) => {
      expect(dirsForRootEqualToCwd).toStrictEqual(["/repo/.git/worktrees/pr-1"]);
    });
  });

  describe("リポジトリルートも共通ディレクトリも null である", () => {
    const it = test.extend("dirsForNullPaths", () =>
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: null, sharedGitDir: null }));

    it("両方 null なら空になる", ({ dirsForNullPaths }) => {
      expect(dirsForNullPaths).toStrictEqual([]);
    });
  });

  describe("リポジトリルートと共通ディレクトリが同じ値である", () => {
    const it = test.extend("dirsForRepeatedPath", () =>
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "/repo", sharedGitDir: "/repo" }));

    it("重複は先勝ちで除去される", ({ dirsForRepeatedPath }) => {
      expect(dirsForRepeatedPath).toStrictEqual(["/repo"]);
    });
  });

  describe("リポジトリルートが空文字列である", () => {
    const it = test.extend("dirsForEmptyRoot", () =>
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "", sharedGitDir: "/repo/.git" }));

    it("空文字列は落とされる", ({ dirsForEmptyRoot }) => {
      expect(dirsForEmptyRoot).toStrictEqual(["/repo/.git"]);
    });
  });
});
