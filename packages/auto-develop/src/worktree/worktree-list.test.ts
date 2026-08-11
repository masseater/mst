import { describe, expect, test } from "vite-plus/test";

import { parseWorktreeList } from "./worktree-list.ts";

describe("parseWorktreeList", () => {
  test("porcelain 出力からパスとブランチを取り出す", () => {
    const porcelain = [
      "worktree /repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /tmp/auto-develop-worktree/pr-7",
      "HEAD def456",
      "branch refs/heads/topic/x",
    ].join("\n");
    expect(parseWorktreeList(porcelain)).toStrictEqual([
      { path: "/repo", branch: "main" },
      { path: "/tmp/auto-develop-worktree/pr-7", branch: "topic/x" },
    ]);
  });

  test("detached HEAD の worktree はブランチ null になる", () => {
    const porcelain = ["worktree /tmp/auto-develop-worktree/pr-9", "HEAD abc123", "detached"].join(
      "\n",
    );
    expect(parseWorktreeList(porcelain)).toStrictEqual([
      { path: "/tmp/auto-develop-worktree/pr-9", branch: null },
    ]);
  });

  test("worktree 行を持たないブロックは読み飛ばす", () => {
    const porcelain = ["HEAD abc123", "branch refs/heads/main"].join("\n");
    expect(parseWorktreeList(porcelain)).toStrictEqual([]);
  });

  test("空の出力は空配列になる", () => {
    expect(parseWorktreeList("")).toStrictEqual([]);
  });
});
