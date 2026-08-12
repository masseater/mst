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

const recordingGit = (): {
  readonly git: GitRunner;
  readonly calls: () => readonly (readonly string[])[];
} => {
  const recorded = new Map<number, readonly string[]>();
  return {
    git: {
      run: (invocation) => {
        recorded.set(recorded.size, invocation.args);
        return Promise.resolve({ stdout: "", stderr: "" });
      },
    },
    calls: () => [...recorded.values()],
  };
};

const it = test
  .extend("pruneThenRemove", async () => {
    const { git, calls } = recordingGit();
    const removed = vi.fn<(path: string) => void>();
    await cleanupWorktreeMetadata({
      git,
      repoDir: "/repo",
      worktreePath: "/tmp/auto-develop-worktree/pr-7",
      fs: { ...noopFs, removeRecursive: removed },
      sharedGitDir: "/repo/.git",
      log: silentLogger,
    });
    return { gitCalls: calls(), removedCalls: removed.mock.calls };
  })
  .extend("pruneFailureCleanup", async () => {
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
    return { warnCalls: warn.mock.calls, removedCalls: removed.mock.calls };
  })
  .extend("removalFailureWarnCalls", async () => {
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
    return warn.mock.calls;
  });

describe("cleanupWorktreeMetadata", () => {
  it("prune を呼ぶ", ({ pruneThenRemove }) => {
    expect(pruneThenRemove.gitCalls).toStrictEqual([["worktree", "prune"]]);
  });

  it("prune の後にメタデータディレクトリを消す", ({ pruneThenRemove }) => {
    expect(pruneThenRemove.removedCalls).toStrictEqual([["/repo/.git/worktrees/pr-7"]]);
  });

  it("prune の失敗は警告のみになる", ({ pruneFailureCleanup }) => {
    expect(pruneFailureCleanup.warnCalls.length).toStrictEqual(1);
  });

  it("prune が失敗してもメタデータ削除に進む", ({ pruneFailureCleanup }) => {
    expect(pruneFailureCleanup.removedCalls.length).toStrictEqual(1);
  });

  it("メタデータ削除の失敗も警告のみで全体を止めない", ({ removalFailureWarnCalls }) => {
    expect(removalFailureWarnCalls.length).toStrictEqual(1);
  });
});
