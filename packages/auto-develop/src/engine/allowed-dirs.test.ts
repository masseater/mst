import { describe, expect, test } from "vite-plus/test";

import { normalizeAllowedDirs } from "./allowed-dirs.ts";

describe("normalizeAllowedDirs", () => {
  test("リポジトリルートと共通ディレクトリをこの順で並べる", () => {
    expect(
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
    ).toStrictEqual(["/repo", "/repo/.git"]);
  });

  test("ルートが cwd と同一なら除外され共通ディレクトリだけになる", () => {
    expect(
      normalizeAllowedDirs({
        cwd: "/work/pr-1",
        repoRoot: "/work/pr-1",
        sharedGitDir: "/repo/.git/worktrees/pr-1",
      }),
    ).toStrictEqual(["/repo/.git/worktrees/pr-1"]);
  });

  test("両方 null なら空になる", () => {
    expect(
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: null, sharedGitDir: null }),
    ).toStrictEqual([]);
  });

  test("重複は先勝ちで除去される", () => {
    expect(
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "/repo", sharedGitDir: "/repo" }),
    ).toStrictEqual(["/repo"]);
  });

  test("空文字列は落とされる", () => {
    expect(
      normalizeAllowedDirs({ cwd: "/work/pr-1", repoRoot: "", sharedGitDir: "/repo/.git" }),
    ).toStrictEqual(["/repo/.git"]);
  });
});
