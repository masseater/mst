import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { acquireWorktree, type AcquireContext } from "./acquire-worktree.ts";
import { worktreePathFor } from "./paths.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

const managedPath = worktreePathFor(7);

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

const fakeFs = (
  existing: readonly string[] = [],
): WorktreeFs & { readonly markers: () => readonly string[] } => {
  const present = new Set(existing);
  const writtenMarkers = new Map<number, string>();
  return {
    exists: (path) => present.has(path),
    removeRecursive: (path) => present.delete(path),
    writeMarker: (worktreePath) => {
      writtenMarkers.set(writtenMarkers.size, worktreePath);
    },
    markerMtimeMs: () => null,
    markers: () => [...writtenMarkers.values()],
  };
};

const statefulFsAppearingOnAdd = (): {
  readonly git: GitRunner;
  readonly fs: WorktreeFs;
  readonly removed: () => readonly string[];
} => {
  const present = new Set<string>();
  const removedPaths = new Map<number, string>();
  const fs: WorktreeFs = {
    exists: (path) => present.has(path),
    removeRecursive: (path) => {
      removedPaths.set(removedPaths.size, path);
      present.delete(path);
    },
    writeMarker: () => undefined,
    markerMtimeMs: () => null,
  };
  const runFailingOnAdd: GitRunner["run"] = (invocation) => {
    if (invocation.args.join(" ") !== `worktree add ${managedPath} topic/x`) {
      return Promise.resolve({ stdout: "", stderr: "" });
    }
    present.add(managedPath);
    return Promise.reject(new Error("add failed"));
  };
  return { git: { run: runFailingOnAdd }, fs, removed: () => [...removedPaths.values()] };
};

const contextWith = (parts: {
  readonly git: GitRunner;
  readonly fs: WorktreeFs;
}): AcquireContext => ({
  git: parts.git,
  repoDir: "/repo",
  sharedGitDir: "/repo/.git",
  fs: parts.fs,
  log: silentLogger,
  now: () => new Date("2026-08-11T00:00:00.000Z"),
});

describe("acquireWorktree", () => {
  test("head を強制 refspec で fetch してから作り直し reset とマーカーで終える", async () => {
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: "" },
    });
    const fs = fakeFs();
    const acquired = await acquireWorktree({
      context: contextWith({ git, fs }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    expect([acquired, calls(), fs.markers()]).toStrictEqual([
      managedPath,
      [
        "fetch origin +refs/heads/topic/x:refs/remotes/origin/topic/x",
        "worktree list --porcelain",
        "worktree prune",
        `worktree add ${managedPath} topic/x`,
        `reset --hard origin/topic/x`,
      ],
      [managedPath],
    ]);
  });

  test("base ブランチ指定時は base も fetch する", async () => {
    const { git, calls } = gitFor({ "worktree list --porcelain": { stdout: "" } });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs() }),
      request: { headBranch: "topic/x", baseBranch: "main", prNumber: 7 },
    });
    expect(calls().slice(0, 2)).toStrictEqual([
      "fetch origin +refs/heads/topic/x:refs/remotes/origin/topic/x",
      "fetch origin +refs/heads/main:refs/remotes/origin/main",
    ]);
  });

  test("登録済みで同ブランチ・実体ありなら clean と reset で再利用する", async () => {
    const listOutput = `worktree ${managedPath}\nHEAD abc\nbranch refs/heads/topic/x`;
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: listOutput },
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
    });
    const fs = fakeFs([managedPath]);
    await acquireWorktree({
      context: contextWith({ git, fs }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    expect(calls()).not.toContain(`worktree add ${managedPath} topic/x`);
    expect(calls()).toContain("clean -ffdx");
  });

  test("再利用の reset が失敗したら作り直しへ落ちる", async () => {
    const listOutput = `worktree ${managedPath}\nHEAD abc\nbranch refs/heads/topic/x`;
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: listOutput },
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
      "clean -ffdx": { error: new Error("rebase in progress") },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    const fs = fakeFs([managedPath]);
    await acquireWorktree({
      context: contextWith({ git, fs }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    expect(calls()).toContain(`worktree add ${managedPath} topic/x`);
  });

  test("同じ head を別 worktree が持つなら再利用せず作り直す", async () => {
    const listOutput = [
      `worktree ${managedPath}`,
      "HEAD abc",
      "branch refs/heads/topic/x",
      "",
      "worktree /tmp/auto-develop-worktree/pr-9",
      "HEAD def",
      "branch refs/heads/topic/x",
    ].join("\n");
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: listOutput },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    const fs = fakeFs([managedPath]);
    await acquireWorktree({
      context: contextWith({ git, fs }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    expect(calls()).toContain(`worktree add ${managedPath} topic/x`);
  });

  test("登録はあるが実体が無ければ現在ブランチを問わず作り直す", async () => {
    const listOutput = `worktree ${managedPath}\nHEAD abc\nbranch refs/heads/topic/x`;
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: listOutput },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    const fs = fakeFs();
    await acquireWorktree({
      context: contextWith({ git, fs }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    expect(calls()).not.toContain("symbolic-ref --short HEAD");
    expect(calls()).toContain(`worktree add ${managedPath} topic/x`);
  });

  test("base が head と同じなら base の fetch は行わない", async () => {
    const { git, calls } = gitFor({ "worktree list --porcelain": { stdout: "" } });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs() }),
      request: { headBranch: "topic/x", baseBranch: "topic/x", prNumber: 7 },
    });
    const fetchCalls = calls().filter((call) => call.startsWith("fetch origin +"));
    expect(fetchCalls).toStrictEqual([
      "fetch origin +refs/heads/topic/x:refs/remotes/origin/topic/x",
    ]);
  });

  test("登録先が別ブランチを持つなら再利用せず作り直す", async () => {
    const listOutput = `worktree ${managedPath}\nHEAD abc\nbranch refs/heads/topic/x`;
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: listOutput },
      "symbolic-ref --short HEAD": { stdout: "other-branch\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    const fs = fakeFs([managedPath]);
    await acquireWorktree({
      context: contextWith({ git, fs }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    expect(calls()).not.toContain("clean -ffdx");
    expect(calls()).toContain(`worktree add ${managedPath} topic/x`);
  });

  test("作成コマンドが失敗し作りかけが残っていれば掃除して元のエラーを投げる", async () => {
    const stateful = statefulFsAppearingOnAdd();
    await expect(
      acquireWorktree({
        context: contextWith({ git: stateful.git, fs: stateful.fs }),
        request: { headBranch: "topic/x", prNumber: 7 },
      }),
    ).rejects.toThrow("add failed");
    expect(stateful.removed()).toContain(managedPath);
  });

  test("作成失敗時に作りかけが残っていなければ fs 削除を呼ばず元のエラーを投げる", async () => {
    const { git } = gitFor({
      "worktree list --porcelain": { stdout: "" },
      [`worktree add ${managedPath} topic/x`]: { error: new Error("add failed") },
    });
    const removed = new Map<number, string>();
    const fs: WorktreeFs = {
      exists: () => false,
      removeRecursive: (path) => {
        removed.set(removed.size, path);
      },
      writeMarker: () => undefined,
      markerMtimeMs: () => null,
    };
    await expect(
      acquireWorktree({
        context: contextWith({ git, fs }),
        request: { headBranch: "topic/x", prNumber: 7 },
      }),
    ).rejects.toThrow("add failed");
    expect([...removed.values()]).toStrictEqual(["/repo/.git/worktrees/pr-7"]);
  });
});
