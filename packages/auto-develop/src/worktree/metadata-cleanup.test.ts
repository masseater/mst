import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger, type Logger } from "../logging/logger.ts";
import { cleanupWorktreeMetadata } from "./metadata-cleanup.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

describe("cleanupWorktreeMetadata", () => {
  const it = test
    .extend("prunedGitRun", async () => {
      const gitRun = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await cleanupWorktreeMetadata({
        git: { run: gitRun },
        repoDir: "/repo",
        worktreePath: "/tmp/auto-develop-worktree/pr-7",
        fs: {
          exists: () => false,
          removeRecursive: () => undefined,
          writeMarker: () => undefined,
          markerMtimeMs: () => null,
        },
        sharedGitDir: "/repo/.git",
        log: silentLogger,
      });
      return gitRun;
    })
    .extend("metadataRemovalAfterPrune", async () => {
      const removeRecursive = vi.fn<WorktreeFs["removeRecursive"]>();
      await cleanupWorktreeMetadata({
        git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
        repoDir: "/repo",
        worktreePath: "/tmp/auto-develop-worktree/pr-7",
        fs: {
          exists: () => false,
          removeRecursive,
          writeMarker: () => undefined,
          markerMtimeMs: () => null,
        },
        sharedGitDir: "/repo/.git",
        log: silentLogger,
      });
      return removeRecursive;
    })
    .extend("pruneFailureWarn", async () => {
      const warn = vi.fn<Logger["warn"]>();
      await cleanupWorktreeMetadata({
        git: { run: () => Promise.reject(new Error("prune broke")) },
        repoDir: "/repo",
        worktreePath: "/tmp/auto-develop-worktree/pr-7",
        fs: {
          exists: () => false,
          removeRecursive: () => undefined,
          writeMarker: () => undefined,
          markerMtimeMs: () => null,
        },
        sharedGitDir: "/repo/.git",
        log: { ...silentLogger, warn },
      });
      return warn;
    })
    .extend("metadataRemovalAfterPruneFailure", async () => {
      const removeRecursive = vi.fn<WorktreeFs["removeRecursive"]>();
      await cleanupWorktreeMetadata({
        git: { run: () => Promise.reject(new Error("prune broke")) },
        repoDir: "/repo",
        worktreePath: "/tmp/auto-develop-worktree/pr-7",
        fs: {
          exists: () => false,
          removeRecursive,
          writeMarker: () => undefined,
          markerMtimeMs: () => null,
        },
        sharedGitDir: "/repo/.git",
        log: silentLogger,
      });
      return removeRecursive;
    })
    .extend("removalFailureWarn", async () => {
      const warn = vi.fn<Logger["warn"]>();
      await cleanupWorktreeMetadata({
        git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
        repoDir: "/repo",
        worktreePath: "/tmp/auto-develop-worktree/pr-7",
        fs: {
          exists: () => false,
          removeRecursive: () => {
            throw new Error("permission denied");
          },
          writeMarker: () => undefined,
          markerMtimeMs: () => null,
        },
        sharedGitDir: "/repo/.git",
        log: { ...silentLogger, warn },
      });
      return warn;
    });

  it("prune を呼ぶ", ({ prunedGitRun }) => {
    expect(prunedGitRun).toHaveBeenCalledWith({ args: ["worktree", "prune"], cwd: "/repo" });
  });

  it("prune の後にメタデータディレクトリを消す", ({ metadataRemovalAfterPrune }) => {
    expect(metadataRemovalAfterPrune).toHaveBeenCalledWith("/repo/.git/worktrees/pr-7");
  });

  it("prune の失敗は警告のみになる", ({ pruneFailureWarn }) => {
    expect(pruneFailureWarn).toHaveBeenCalledTimes(1);
  });

  it("prune が失敗してもメタデータ削除に進む", ({ metadataRemovalAfterPruneFailure }) => {
    expect(metadataRemovalAfterPruneFailure).toHaveBeenCalledTimes(1);
  });

  it("メタデータ削除の失敗も警告のみで全体を止めない", ({ removalFailureWarn }) => {
    expect(removalFailureWarn).toHaveBeenCalledTimes(1);
  });
});
