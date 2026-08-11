import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { cleanupWorktreeMetadata } from "./metadata-cleanup.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

const noopFs: WorktreeFs = {
  exists: () => false,
  removeRecursive: () => undefined,
  writeMarker: () => undefined,
  markerMtimeMs: () => null,
};

describe("cleanupWorktreeMetadata", () => {
  test("prune してからメタデータディレクトリを消す", async () => {
    const gitCalls = new Map<number, readonly string[]>();
    const git: GitRunner = {
      run: (invocation) => {
        gitCalls.set(gitCalls.size, invocation.args);
        return Promise.resolve({ stdout: "", stderr: "" });
      },
    };
    const removed = vi.fn<(path: string) => void>();
    await cleanupWorktreeMetadata({
      git,
      repoDir: "/repo",
      worktreePath: "/tmp/auto-develop-worktree/pr-7",
      fs: { ...noopFs, removeRecursive: removed },
      sharedGitDir: "/repo/.git",
      log: silentLogger,
    });
    expect([[...gitCalls.values()], removed.mock.calls]).toStrictEqual([
      [["worktree", "prune"]],
      [["/repo/.git/worktrees/pr-7"]],
    ]);
  });

  test("prune の失敗は警告のみでメタデータ削除に進む", async () => {
    const git: GitRunner = { run: () => Promise.reject(new Error("prune broke")) };
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const removed = vi.fn<(path: string) => void>();
    await cleanupWorktreeMetadata({
      git,
      repoDir: "/repo",
      worktreePath: "/tmp/auto-develop-worktree/pr-7",
      fs: { ...noopFs, removeRecursive: removed },
      sharedGitDir: "/repo/.git",
      log: { ...silentLogger, warn },
    });
    expect([warn.mock.calls.length, removed.mock.calls.length]).toStrictEqual([1, 1]);
  });

  test("メタデータ削除の失敗も警告のみで全体を止めない", async () => {
    const git: GitRunner = { run: () => Promise.resolve({ stdout: "", stderr: "" }) };
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    await cleanupWorktreeMetadata({
      git,
      repoDir: "/repo",
      worktreePath: "/tmp/auto-develop-worktree/pr-7",
      fs: {
        ...noopFs,
        removeRecursive: () => {
          throw new Error("permission denied");
        },
      },
      sharedGitDir: "/repo/.git",
      log: { ...silentLogger, warn },
    });
    expect(warn.mock.calls.length).toStrictEqual(1);
  });
});
