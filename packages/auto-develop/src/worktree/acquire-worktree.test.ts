import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { acquireWorktree, type AcquireContext } from "./acquire-worktree.ts";
import { worktreePathFor } from "./paths.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

const managedPath = worktreePathFor(7);

const gitFor = (
  producedByCommand: Readonly<Record<string, { readonly stdout?: string; readonly error?: Error }>>,
): { readonly git: GitRunner; readonly calls: () => readonly string[] } => {
  const recorded = new Map<number, string>();
  return {
    git: {
      run: (invocation) => {
        const named = invocation.args.join(" ");
        recorded.set(recorded.size, named);
        const scriptedOutput = producedByCommand[named];
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

const registeredListOutput = `worktree ${managedPath}\nHEAD abc\nbranch refs/heads/topic/x`;

const it = test
  .extend("freshAcquisition", async () => {
    const { git, calls } = gitFor({ "worktree list --porcelain": { stdout: "" } });
    const fs = fakeFs();
    const acquired = await acquireWorktree({
      context: contextWith({ git, fs }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    return { acquired, calls: calls(), markers: fs.markers() };
  })
  .extend("baseBranchFetchCalls", async () => {
    const { git, calls } = gitFor({ "worktree list --porcelain": { stdout: "" } });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs() }),
      request: { headBranch: "topic/x", baseBranch: "main", prNumber: 7 },
    });
    return calls();
  })
  .extend("reuseCalls", async () => {
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: registeredListOutput },
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
    });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs([managedPath]) }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    return calls();
  })
  .extend("resetFailureCalls", async () => {
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: registeredListOutput },
      "symbolic-ref --short HEAD": { stdout: "topic/x\n" },
      "clean -ffdx": { error: new Error("rebase in progress") },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs([managedPath]) }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    return calls();
  })
  .extend("duplicateHeadCalls", async () => {
    const { git, calls } = gitFor({
      "worktree list --porcelain": {
        stdout: [
          `worktree ${managedPath}`,
          "HEAD abc",
          "branch refs/heads/topic/x",
          "",
          "worktree /tmp/auto-develop-worktree/pr-9",
          "HEAD def",
          "branch refs/heads/topic/x",
        ].join("\n"),
      },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs([managedPath]) }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    return calls();
  })
  .extend("missingDirectoryCalls", async () => {
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: registeredListOutput },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs() }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    return calls();
  })
  .extend("sameBaseAsHeadCalls", async () => {
    const { git, calls } = gitFor({ "worktree list --porcelain": { stdout: "" } });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs() }),
      request: { headBranch: "topic/x", baseBranch: "topic/x", prNumber: 7 },
    });
    return calls();
  })
  .extend("otherBranchCalls", async () => {
    const { git, calls } = gitFor({
      "worktree list --porcelain": { stdout: registeredListOutput },
      "symbolic-ref --short HEAD": { stdout: "other-branch\n" },
      "symbolic-ref refs/remotes/origin/HEAD": { stdout: "refs/remotes/origin/main\n" },
    });
    await acquireWorktree({
      context: contextWith({ git, fs: fakeFs([managedPath]) }),
      request: { headBranch: "topic/x", prNumber: 7 },
    });
    return calls();
  })
  .extend(
    "addFailureWithLeftover",
    async (): Promise<{ readonly caught: Error | null; readonly removed: readonly string[] }> => {
      const stateful = statefulFsAppearingOnAdd();
      try {
        await acquireWorktree({
          context: contextWith({ git: stateful.git, fs: stateful.fs }),
          request: { headBranch: "topic/x", prNumber: 7 },
        });
        return { caught: null, removed: stateful.removed() };
      } catch (acquireFailure) {
        return {
          caught: acquireFailure instanceof Error ? acquireFailure : null,
          removed: stateful.removed(),
        };
      }
    },
  )
  .extend(
    "addFailureWithoutLeftover",
    async (): Promise<{ readonly caught: Error | null; readonly removed: readonly string[] }> => {
      const { git } = gitFor({
        "worktree list --porcelain": { stdout: "" },
        [`worktree add ${managedPath} topic/x`]: { error: new Error("add failed") },
      });
      const removedPaths = new Map<number, string>();
      const fs: WorktreeFs = {
        exists: () => false,
        removeRecursive: (path) => {
          removedPaths.set(removedPaths.size, path);
        },
        writeMarker: () => undefined,
        markerMtimeMs: () => null,
      };
      try {
        await acquireWorktree({
          context: contextWith({ git, fs }),
          request: { headBranch: "topic/x", prNumber: 7 },
        });
        return { caught: null, removed: [...removedPaths.values()] };
      } catch (acquireFailure) {
        return {
          caught: acquireFailure instanceof Error ? acquireFailure : null,
          removed: [...removedPaths.values()],
        };
      }
    },
  );

describe("acquireWorktree", () => {
  it("取得した worktree のパスを返す", ({ freshAcquisition }) => {
    expect(freshAcquisition.acquired).toStrictEqual(managedPath);
  });

  it("head を強制 refspec で fetch してから作り直し reset で終える", ({ freshAcquisition }) => {
    expect(freshAcquisition.calls).toStrictEqual([
      "fetch origin +refs/heads/topic/x:refs/remotes/origin/topic/x",
      "worktree list --porcelain",
      "worktree prune",
      `worktree add ${managedPath} topic/x`,
      `reset --hard origin/topic/x`,
    ]);
  });

  it("最後に最終使用マーカーを書く", ({ freshAcquisition }) => {
    expect(freshAcquisition.markers).toStrictEqual([managedPath]);
  });

  it("head を先に fetch する", ({ baseBranchFetchCalls }) => {
    expect(baseBranchFetchCalls[0]).toStrictEqual(
      "fetch origin +refs/heads/topic/x:refs/remotes/origin/topic/x",
    );
  });

  it("base ブランチ指定時は base も fetch する", ({ baseBranchFetchCalls }) => {
    expect(baseBranchFetchCalls[1]).toStrictEqual(
      "fetch origin +refs/heads/main:refs/remotes/origin/main",
    );
  });

  it("登録済みで同ブランチ・実体ありなら作り直さない", ({ reuseCalls }) => {
    expect(reuseCalls).not.toContain(`worktree add ${managedPath} topic/x`);
  });

  it("登録済みで同ブランチ・実体ありなら clean で再利用する", ({ reuseCalls }) => {
    expect(reuseCalls).toContain("clean -ffdx");
  });

  it("再利用の reset が失敗したら作り直しへ落ちる", ({ resetFailureCalls }) => {
    expect(resetFailureCalls).toContain(`worktree add ${managedPath} topic/x`);
  });

  it("同じ head を別 worktree が持つなら再利用せず作り直す", ({ duplicateHeadCalls }) => {
    expect(duplicateHeadCalls).toContain(`worktree add ${managedPath} topic/x`);
  });

  it("登録はあるが実体が無ければ現在ブランチを問い合わせない", ({ missingDirectoryCalls }) => {
    expect(missingDirectoryCalls).not.toContain("symbolic-ref --short HEAD");
  });

  it("登録はあるが実体が無ければ作り直す", ({ missingDirectoryCalls }) => {
    expect(missingDirectoryCalls).toContain(`worktree add ${managedPath} topic/x`);
  });

  it("base が head と同じなら base の fetch は行わない", ({ sameBaseAsHeadCalls }) => {
    expect(sameBaseAsHeadCalls).toStrictEqual([
      "fetch origin +refs/heads/topic/x:refs/remotes/origin/topic/x",
      "worktree list --porcelain",
      "worktree prune",
      `worktree add ${managedPath} topic/x`,
      `reset --hard origin/topic/x`,
    ]);
  });

  it("登録先が別ブランチを持つなら再利用しない", ({ otherBranchCalls }) => {
    expect(otherBranchCalls).not.toContain("clean -ffdx");
  });

  it("登録先が別ブランチを持つなら作り直す", ({ otherBranchCalls }) => {
    expect(otherBranchCalls).toContain(`worktree add ${managedPath} topic/x`);
  });

  it("作成コマンドが失敗したら元のエラーを投げる", ({ addFailureWithLeftover }) => {
    expect(addFailureWithLeftover.caught?.message).toStrictEqual("add failed");
  });

  it("作成コマンドが失敗し作りかけが残っていれば掃除する", ({ addFailureWithLeftover }) => {
    expect(addFailureWithLeftover.removed).toContain(managedPath);
  });

  it("作成失敗時に作りかけが残っていなくても元のエラーを投げる", ({
    addFailureWithoutLeftover,
  }) => {
    expect(addFailureWithoutLeftover.caught?.message).toStrictEqual("add failed");
  });

  it("作成失敗時に作りかけが残っていなければ worktree の fs 削除を呼ばない", ({
    addFailureWithoutLeftover,
  }) => {
    expect(addFailureWithoutLeftover.removed).toStrictEqual(["/repo/.git/worktrees/pr-7"]);
  });
});
