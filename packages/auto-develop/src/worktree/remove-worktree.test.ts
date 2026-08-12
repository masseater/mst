import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { worktreePathFor } from "./paths.ts";
import { removeWorktree, type RemoveContext } from "./remove-worktree.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

class NotAWorkingTreeError extends Error {
  readonly stderr = "fatal: 'x' is not a working tree";
}

const managedPath = worktreePathFor(7);

const fakeFs = (
  overrides: Partial<WorktreeFs> & { readonly existing?: readonly string[] } = {},
): WorktreeFs & { readonly removed: () => readonly string[] } => {
  const removedPaths = new Map<number, string>();
  const existing = new Set(overrides.existing ?? [managedPath]);
  return {
    exists: overrides.exists ?? ((path) => existing.has(path)),
    removeRecursive:
      overrides.removeRecursive ??
      ((path) => {
        removedPaths.set(removedPaths.size, path);
        existing.delete(path);
      }),
    writeMarker: overrides.writeMarker ?? (() => undefined),
    markerMtimeMs: overrides.markerMtimeMs ?? (() => null),
    removed: () => [...removedPaths.values()],
  };
};

const gitFor = (
  outputs: Readonly<Record<string, { readonly stdout?: string; readonly error?: Error }>>,
): { readonly git: GitRunner; readonly calls: () => readonly string[] } => {
  const recorded = new Map<number, string>();
  return {
    git: {
      run: (invocation) => {
        const key = invocation.args.join(" ");
        recorded.set(recorded.size, key);
        const scriptedOutput = outputs[key];
        if (scriptedOutput?.error !== undefined) return Promise.reject(scriptedOutput.error);
        return Promise.resolve({ stdout: scriptedOutput?.stdout ?? "", stderr: "" });
      },
    },
    calls: () => [...recorded.values()],
  };
};

const contextWith = (parts: {
  readonly git: GitRunner;
  readonly fs: WorktreeFs;
}): RemoveContext => ({
  git: parts.git,
  repoDir: "/repo",
  sharedGitDir: "/repo/.git",
  fs: parts.fs,
  log: silentLogger,
});

const branchResolvingGit = {
  "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
  "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
};

const it = test
  .extend("unmanagedPathRemoval", async () => {
    const { git, calls } = gitFor({});
    const fs = fakeFs();
    await removeWorktree({
      context: contextWith({ git, fs }),
      worktreePath: "/tmp/elsewhere/pr-7",
    });
    return { calls: calls(), removed: fs.removed() };
  })
  .extend("repoRootRemovalCalls", async () => {
    const { git, calls } = gitFor({});
    await removeWorktree({
      context: { ...contextWith({ git, fs: fakeFs() }), repoDir: managedPath },
      worktreePath: managedPath,
    });
    return calls();
  })
  .extend("missingDirectoryRemovalCalls", async () => {
    const { git, calls } = gitFor({});
    await removeWorktree({
      context: contextWith({ git, fs: fakeFs({ existing: [] }) }),
      worktreePath: managedPath,
    });
    return calls();
  })
  .extend("protectedBranchRemoval", async () => {
    const { git, calls } = gitFor({
      "symbolic-ref --short HEAD": { stdout: "main\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    const fs = fakeFs();
    await removeWorktree({ context: contextWith({ git, fs }), worktreePath: managedPath });
    return { calls: calls(), removed: fs.removed() };
  })
  .extend("normalRemovalCalls", async () => {
    const { git, calls } = gitFor(branchResolvingGit);
    await removeWorktree({
      context: contextWith({ git, fs: fakeFs() }),
      worktreePath: managedPath,
    });
    return calls();
  })
  .extend("fallbackRemovedPaths", async () => {
    const { git } = gitFor({
      ...branchResolvingGit,
      [`worktree remove --force --force ${managedPath}`]: { error: new NotAWorkingTreeError() },
    });
    const fs = fakeFs();
    await removeWorktree({ context: contextWith({ git, fs }), worktreePath: managedPath });
    return fs.removed();
  })
  .extend("otherGitFailure", async (): Promise<Error | null> => {
    const { git } = gitFor({
      ...branchResolvingGit,
      [`worktree remove --force --force ${managedPath}`]: { error: new Error("disk full") },
    });
    try {
      await removeWorktree({
        context: contextWith({ git, fs: fakeFs() }),
        worktreePath: managedPath,
      });
      return null;
    } catch (removalFailure) {
      return removalFailure instanceof Error ? removalFailure : null;
    }
  })
  .extend("pruneFailureWarnCalls", async () => {
    const { git } = gitFor({
      ...branchResolvingGit,
      "worktree prune": { error: new Error("prune broke") },
    });
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    await removeWorktree({
      context: { ...contextWith({ git, fs: fakeFs() }), log: { ...silentLogger, warn } },
      worktreePath: managedPath,
    });
    return warn.mock.calls;
  });

describe("removeWorktree", () => {
  it("管理外のパスには git を触らない", ({ unmanagedPathRemoval }) => {
    expect(unmanagedPathRemoval.calls).toStrictEqual([]);
  });

  it("管理外のパスには fs も触らない", ({ unmanagedPathRemoval }) => {
    expect(unmanagedPathRemoval.removed).toStrictEqual([]);
  });

  it("リポジトリルートと同一のパスは削除しない", ({ repoRootRemovalCalls }) => {
    expect(repoRootRemovalCalls).toStrictEqual([]);
  });

  it("ディレクトリが無ければメタデータ掃除だけ行う", ({ missingDirectoryRemovalCalls }) => {
    expect(missingDirectoryRemovalCalls).toStrictEqual(["worktree prune"]);
  });

  it("保護ブランチ上の worktree は git 削除を行わない", ({ protectedBranchRemoval }) => {
    expect(protectedBranchRemoval.calls).not.toContain(
      `worktree remove --force --force ${managedPath}`,
    );
  });

  it("保護ブランチ上の worktree は fs 削除も行わない", ({ protectedBranchRemoval }) => {
    expect(protectedBranchRemoval.removed).toStrictEqual([]);
  });

  it("通常の削除は二重強制で行いメタデータを掃除する", ({ normalRemovalCalls }) => {
    expect(normalRemovalCalls).toStrictEqual([
      "symbolic-ref --short HEAD",
      "symbolic-ref refs/remotes/origin/HEAD",
      `worktree remove --force --force ${managedPath}`,
      "worktree prune",
    ]);
  });

  it("git が working tree でないと言えば fs 削除にフォールバックする", ({
    fallbackRemovedPaths,
  }) => {
    expect(fallbackRemovedPaths).toStrictEqual([managedPath, "/repo/.git/worktrees/pr-7"]);
  });

  it("それ以外の git 失敗は例外として伝播する", ({ otherGitFailure }) => {
    expect(otherGitFailure?.message).toStrictEqual("disk full");
  });

  it("prune の失敗は警告のみで全体を止めない", ({ pruneFailureWarnCalls }) => {
    expect(pruneFailureWarnCalls.length).toBeGreaterThanOrEqual(1);
  });
});
