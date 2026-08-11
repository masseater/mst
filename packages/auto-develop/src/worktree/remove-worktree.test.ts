import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { worktreeRoot } from "./paths.ts";
import { removeWorktree, type RemoveContext } from "./remove-worktree.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

class NotAWorkingTreeError extends Error {
  readonly stderr = "fatal: 'x' is not a working tree";
}

const managedPath = join(worktreeRoot(), "pr-7");

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

describe("removeWorktree", () => {
  test("管理外のパスには git も fs も触れず警告のみ", async () => {
    const { git, calls } = gitFor({});
    const fs = fakeFs();
    await removeWorktree({
      context: contextWith({ git, fs }),
      worktreePath: "/tmp/elsewhere/pr-7",
    });
    expect([calls(), fs.removed()]).toStrictEqual([[], []]);
  });

  test("リポジトリルートと同一のパスは削除しない", async () => {
    const { git, calls } = gitFor({});
    await removeWorktree({
      context: { ...contextWith({ git, fs: fakeFs() }), repoDir: managedPath },
      worktreePath: managedPath,
    });
    expect(calls()).toStrictEqual([]);
  });

  test("ディレクトリが無ければメタデータ掃除だけ行う", async () => {
    const { git, calls } = gitFor({});
    const fs = fakeFs({ existing: [] });
    await removeWorktree({ context: contextWith({ git, fs }), worktreePath: managedPath });
    expect(calls()).toStrictEqual(["worktree prune"]);
  });

  test("保護ブランチ上の worktree は削除しない", async () => {
    const { git, calls } = gitFor({
      "symbolic-ref --short HEAD": { stdout: "main\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    const fs = fakeFs();
    await removeWorktree({ context: contextWith({ git, fs }), worktreePath: managedPath });
    expect([
      calls().includes(`worktree remove --force --force ${managedPath}`),
      fs.removed(),
    ]).toStrictEqual([false, []]);
  });

  test("通常の削除は二重強制で行いメタデータを掃除する", async () => {
    const { git, calls } = gitFor({
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    const fs = fakeFs();
    await removeWorktree({ context: contextWith({ git, fs }), worktreePath: managedPath });
    expect(calls()).toStrictEqual([
      "symbolic-ref --short HEAD",
      "symbolic-ref refs/remotes/origin/HEAD",
      `worktree remove --force --force ${managedPath}`,
      "worktree prune",
    ]);
  });

  test("git が working tree でないと言えば fs 削除にフォールバックする", async () => {
    const { git } = gitFor({
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
      [`worktree remove --force --force ${managedPath}`]: { error: new NotAWorkingTreeError() },
    });
    const fs = fakeFs();
    await removeWorktree({ context: contextWith({ git, fs }), worktreePath: managedPath });
    expect(fs.removed()).toStrictEqual([managedPath, "/repo/.git/worktrees/pr-7"]);
  });

  test("それ以外の git 失敗は例外として伝播する", async () => {
    const { git } = gitFor({
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
      [`worktree remove --force --force ${managedPath}`]: { error: new Error("disk full") },
    });
    await expect(
      removeWorktree({ context: contextWith({ git, fs: fakeFs() }), worktreePath: managedPath }),
    ).rejects.toThrow("disk full");
  });

  test("prune の失敗は警告のみで全体を止めない", async () => {
    const { git } = gitFor({
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
      "worktree prune": { error: new Error("prune broke") },
    });
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    await removeWorktree({
      context: { ...contextWith({ git, fs: fakeFs() }), log: { ...silentLogger, warn } },
      worktreePath: managedPath,
    });
    expect(warn.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
