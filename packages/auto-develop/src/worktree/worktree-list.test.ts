import { describe, expect, test, vi } from "vite-plus/test";

import { listRegisteredWorktrees } from "./worktree-list.ts";

import type { GitRunner } from "./git-runner.ts";

describe("listRegisteredWorktrees", () => {
  const it = test
    .extend("listedTwoWorktrees", () =>
      listRegisteredWorktrees({
        git: {
          run: () =>
            Promise.resolve({
              stdout: [
                "worktree /repo",
                "HEAD abc123",
                "branch refs/heads/main",
                "",
                "worktree /tmp/auto-develop-worktree/pr-7",
                "HEAD def456",
                "branch refs/heads/topic/x",
              ].join("\n"),
              stderr: "",
            }),
        } satisfies GitRunner,
        repoDir: "/repo",
      }))
    .extend("listedDetachedWorktree", () =>
      listRegisteredWorktrees({
        git: {
          run: () =>
            Promise.resolve({
              stdout: ["worktree /tmp/auto-develop-worktree/pr-9", "HEAD abc123", "detached"].join(
                "\n",
              ),
              stderr: "",
            }),
        } satisfies GitRunner,
        repoDir: "/repo",
      }),
    )
    .extend("listedBlockWithoutWorktreeLine", () =>
      listRegisteredWorktrees({
        git: {
          run: () =>
            Promise.resolve({
              stdout: ["HEAD abc123", "branch refs/heads/main"].join("\n"),
              stderr: "",
            }),
        } satisfies GitRunner,
        repoDir: "/repo",
      }),
    )
    .extend("listedEmptyOutput", () =>
      listRegisteredWorktrees({
        git: {
          run: () => Promise.resolve({ stdout: "", stderr: "" }),
        } satisfies GitRunner,
        repoDir: "/repo",
      }),
    )
    .extend("gitRunUnderListing", async () => {
      const runGit = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await listRegisteredWorktrees({
        git: { run: runGit },
        repoDir: "/repo",
      });
      return runGit;
    });

  it("porcelain 形式で一覧を要求する", ({ gitRunUnderListing }) => {
    expect(gitRunUnderListing).toHaveBeenCalledExactlyOnceWith({
      args: ["worktree", "list", "--porcelain"],
      cwd: "/repo",
    });
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
