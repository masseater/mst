import { describe, expect, test } from "vite-plus/test";

import { normalizeAllowedDirs } from "./allowed-dirs.ts";

const it = test
  .extend("dirsForDistinctRoot", () =>
    normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "/repo", sharedGitDir: "/repo/.git" }))
  .extend("dirsForRootEqualToCwd", () =>
    normalizeAllowedDirs({
      cwd: "/work/pr-1",
      repoRoot: "/work/pr-1",
      sharedGitDir: "/repo/.git/worktrees/pr-1",
    }),
  )
  .extend("dirsForNullPaths", () =>
    normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: null, sharedGitDir: null }),
  )
  .extend("dirsForRepeatedPath", () =>
    normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "/repo", sharedGitDir: "/repo" }),
  )
  .extend("dirsForEmptyRoot", () =>
    normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "", sharedGitDir: "/repo/.git" }),
  );

describe("normalizeAllowedDirs", () => {
  it("リポジトリルートと共通ディレクトリをこの順で並べる", ({ dirsForDistinctRoot }) => {
    expect(dirsForDistinctRoot).toStrictEqual(["/repo", "/repo/.git"]);
  });

  it("ルートが cwd と同一なら除外され共通ディレクトリだけになる", ({ dirsForRootEqualToCwd }) => {
    expect(dirsForRootEqualToCwd).toStrictEqual(["/repo/.git/worktrees/pr-1"]);
  });

  it("両方 null なら空になる", ({ dirsForNullPaths }) => {
    expect(dirsForNullPaths).toStrictEqual([]);
  });

  it("重複は先勝ちで除去される", ({ dirsForRepeatedPath }) => {
    expect(dirsForRepeatedPath).toStrictEqual(["/repo"]);
  });

  it("空文字列は落とされる", ({ dirsForEmptyRoot }) => {
    expect(dirsForEmptyRoot).toStrictEqual(["/repo/.git"]);
  });
});
