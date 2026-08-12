import { describe, expect, test } from "vite-plus/test";

import { listRegisteredWorktrees } from "./worktree-list.ts";

import type { GitRunner } from "./git-runner.ts";

const listedBy = (porcelain: string): Promise<readonly { readonly path: string }[]> =>
  listRegisteredWorktrees({
    git: {
      run: () => Promise.resolve({ stdout: porcelain, stderr: "" }),
    } satisfies GitRunner,
    repoDir: "/repo",
  });

const it = test
  .extend("listedTwoWorktrees", () =>
    listedBy(
      [
        "worktree /repo",
        "HEAD abc123",
        "branch refs/heads/main",
        "",
        "worktree /tmp/auto-develop-worktree/pr-7",
        "HEAD def456",
        "branch refs/heads/topic/x",
      ].join("\n"),
    ))
  .extend("listedDetachedWorktree", () =>
    listedBy(["worktree /tmp/auto-develop-worktree/pr-9", "HEAD abc123", "detached"].join("\n")),
  )
  .extend("listedBlockWithoutWorktreeLine", () =>
    listedBy(["HEAD abc123", "branch refs/heads/main"].join("\n")),
  )
  .extend("listedEmptyOutput", () => listedBy(""))
  .extend("listInvocation", async () => {
    const invocations = new Map<number, readonly string[]>();
    await listRegisteredWorktrees({
      git: {
        run: (invocation) => {
          invocations.set(invocations.size, invocation.args);
          return Promise.resolve({ stdout: "", stderr: "" });
        },
      } satisfies GitRunner,
      repoDir: "/repo",
    });
    return invocations.get(0);
  });

describe("listRegisteredWorktrees", () => {
  it("porcelain 形式で一覧を要求する", ({ listInvocation }) => {
    expect(listInvocation).toStrictEqual(["worktree", "list", "--porcelain"]);
  });

  it("porcelain 出力からパスとブランチを取り出す", ({ listedTwoWorktrees }) => {
    expect(listedTwoWorktrees).toStrictEqual([
      { path: "/repo", branch: "main" },
      { path: "/tmp/auto-develop-worktree/pr-7", branch: "topic/x" },
    ]);
  });

  it("detached HEAD の worktree はブランチ null になる", ({ listedDetachedWorktree }) => {
    expect(listedDetachedWorktree).toStrictEqual([
      { path: "/tmp/auto-develop-worktree/pr-9", branch: null },
    ]);
  });

  it("worktree 行を持たないブロックは読み飛ばす", ({ listedBlockWithoutWorktreeLine }) => {
    expect(listedBlockWithoutWorktreeLine).toStrictEqual([]);
  });

  it("空の出力は空配列になる", ({ listedEmptyOutput }) => {
    expect(listedEmptyOutput).toStrictEqual([]);
  });
});
