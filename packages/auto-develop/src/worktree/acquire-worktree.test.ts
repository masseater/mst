import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { acquireWorktree } from "./acquire-worktree.ts";
import { worktreePathFor } from "./paths.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

const managedPath = worktreePathFor(7);

const metadataPath = "/repo/.git/worktrees/pr-7";

const registeredListOutput = `worktree ${managedPath}\nHEAD abc\nbranch refs/heads/topic/x`;

const duplicateHeadListOutput = [
  `worktree ${managedPath}`,
  "HEAD abc",
  "branch refs/heads/topic/x",
  "",
  "worktree /tmp/auto-develop-worktree/pr-9",
  "HEAD def",
  "branch refs/heads/topic/x",
].join("\n");

const headFetchInvocation = {
  args: ["fetch", "origin", "+refs/heads/topic/x:refs/remotes/origin/topic/x"],
  cwd: "/repo",
};

const baseFetchInvocation = {
  args: ["fetch", "origin", "+refs/heads/main:refs/remotes/origin/main"],
  cwd: "/repo",
};

const listInvocation = { args: ["worktree", "list", "--porcelain"], cwd: "/repo" };

const pruneInvocation = { args: ["worktree", "prune"], cwd: "/repo" };

const addInvocation = {
  args: ["worktree", "add", managedPath, "topic/x"],
  cwd: "/repo",
  configOverrides: { "core.hooksPath": "/dev/null" },
};

const resetInvocation = { args: ["reset", "--hard", "origin/topic/x"], cwd: managedPath };

const cleanInvocation = { args: ["clean", "-ffdx"], cwd: managedPath };

const currentBranchInvocation = { args: ["symbolic-ref", "--short", "HEAD"], cwd: managedPath };

describe("acquireWorktree", () => {
  const it = test
    .extend("acquiredWorktreePath", () =>
      acquireWorktree({
        context: {
          git: { run: vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" })) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      }))
    .extend("freshAcquisitionGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      });
      return runGit;
    })
    .extend("freshAcquisitionMarkerWrite", async () => {
      const writeMarker = vi.fn<WorktreeFs["writeMarker"]>();
      await acquireWorktree({
        context: {
          git: { run: vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" })) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      });
      return writeMarker;
    })
    .extend("baseBranchGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", baseBranch: "main", prNumber: 7 },
      });
      return runGit;
    })
    .extend("sameBaseAsHeadGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", baseBranch: "topic/x", prNumber: 7 },
      });
      return runGit;
    })
    .extend("reuseGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>((invocation) => {
        const spelled = invocation.args.join(" ");
        if (spelled === "worktree list --porcelain") {
          return Promise.resolve({ stdout: registeredListOutput, stderr: "" });
        }
        if (spelled === "symbolic-ref --short HEAD") {
          return Promise.resolve({ stdout: "topic/x\n", stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      });
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      });
      return runGit;
    })
    .extend("resetFailureGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>((invocation) => {
        const spelled = invocation.args.join(" ");
        if (spelled === "worktree list --porcelain") {
          return Promise.resolve({ stdout: registeredListOutput, stderr: "" });
        }
        if (spelled === "symbolic-ref --short HEAD") {
          return Promise.resolve({ stdout: "topic/x\n", stderr: "" });
        }
        if (spelled === "clean -ffdx") return Promise.reject(new Error("rebase in progress"));
        return Promise.resolve({ stdout: "", stderr: "" });
      });
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      });
      return runGit;
    })
    .extend("duplicateHeadGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>((invocation) => {
        const spelled = invocation.args.join(" ");
        if (spelled === "worktree list --porcelain") {
          return Promise.resolve({ stdout: duplicateHeadListOutput, stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      });
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      });
      return runGit;
    })
    .extend("missingDirectoryGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>((invocation) => {
        const spelled = invocation.args.join(" ");
        if (spelled === "worktree list --porcelain") {
          return Promise.resolve({ stdout: registeredListOutput, stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      });
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => false,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      });
      return runGit;
    })
    .extend("otherBranchGitRun", async () => {
      const runGit = vi.fn<GitRunner["run"]>((invocation) => {
        const spelled = invocation.args.join(" ");
        if (spelled === "worktree list --porcelain") {
          return Promise.resolve({ stdout: registeredListOutput, stderr: "" });
        }
        if (spelled === "symbolic-ref --short HEAD") {
          return Promise.resolve({ stdout: "other-branch\n", stderr: "" });
        }
        return Promise.resolve({ stdout: "", stderr: "" });
      });
      await acquireWorktree({
        context: {
          git: { run: runGit },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
          now: () => new Date("2026-08-11T00:00:00.000Z"),
        },
        request: { headBranch: "topic/x", prNumber: 7 },
      });
      return runGit;
    })
    .extend("addFailureWithLeftoverSettlement", () =>
      Promise.allSettled([
        acquireWorktree({
          context: {
            git: {
              run: vi.fn<GitRunner["run"]>((invocation) =>
                invocation.args[1] === "add"
                  ? Promise.reject(new Error("add failed"))
                  : Promise.resolve({ stdout: "", stderr: "" }),
              ),
            },
            repoDir: "/repo",
            sharedGitDir: "/repo/.git",
            fs: {
              exists: vi
                .fn<WorktreeFs["exists"]>()
                .mockReturnValueOnce(false)
                .mockReturnValue(true),
              removeRecursive: () => undefined,
              writeMarker: () => undefined,
              markerMtimeMs: () => null,
            },
            log: silentLogger,
            now: () => new Date("2026-08-11T00:00:00.000Z"),
          },
          request: { headBranch: "topic/x", prNumber: 7 },
        }),
      ]),
    )
    .extend("addFailureWithLeftoverRemoval", async () => {
      const removeRecursive = vi.fn<WorktreeFs["removeRecursive"]>();
      await Promise.allSettled([
        acquireWorktree({
          context: {
            git: {
              run: vi.fn<GitRunner["run"]>((invocation) =>
                invocation.args[1] === "add"
                  ? Promise.reject(new Error("add failed"))
                  : Promise.resolve({ stdout: "", stderr: "" }),
              ),
            },
            repoDir: "/repo",
            sharedGitDir: "/repo/.git",
            fs: {
              exists: vi
                .fn<WorktreeFs["exists"]>()
                .mockReturnValueOnce(false)
                .mockReturnValue(true),
              removeRecursive,
              writeMarker: () => undefined,
              markerMtimeMs: () => null,
            },
            log: silentLogger,
            now: () => new Date("2026-08-11T00:00:00.000Z"),
          },
          request: { headBranch: "topic/x", prNumber: 7 },
        }),
      ]);
      return removeRecursive;
    })
    .extend("addFailureWithoutLeftoverSettlement", () =>
      Promise.allSettled([
        acquireWorktree({
          context: {
            git: {
              run: vi.fn<GitRunner["run"]>((invocation) =>
                invocation.args[1] === "add"
                  ? Promise.reject(new Error("add failed"))
                  : Promise.resolve({ stdout: "", stderr: "" }),
              ),
            },
            repoDir: "/repo",
            sharedGitDir: "/repo/.git",
            fs: {
              exists: () => false,
              removeRecursive: () => undefined,
              writeMarker: () => undefined,
              markerMtimeMs: () => null,
            },
            log: silentLogger,
            now: () => new Date("2026-08-11T00:00:00.000Z"),
          },
          request: { headBranch: "topic/x", prNumber: 7 },
        }),
      ]),
    )
    .extend("addFailureWithoutLeftoverRemoval", async () => {
      const removeRecursive = vi.fn<WorktreeFs["removeRecursive"]>();
      await Promise.allSettled([
        acquireWorktree({
          context: {
            git: {
              run: vi.fn<GitRunner["run"]>((invocation) =>
                invocation.args[1] === "add"
                  ? Promise.reject(new Error("add failed"))
                  : Promise.resolve({ stdout: "", stderr: "" }),
              ),
            },
            repoDir: "/repo",
            sharedGitDir: "/repo/.git",
            fs: {
              exists: () => false,
              removeRecursive,
              writeMarker: () => undefined,
              markerMtimeMs: () => null,
            },
            log: silentLogger,
            now: () => new Date("2026-08-11T00:00:00.000Z"),
          },
          request: { headBranch: "topic/x", prNumber: 7 },
        }),
      ]);
      return removeRecursive;
    });

  it("取得した worktree のパスを返す", ({ acquiredWorktreePath }) => {
    expect(acquiredWorktreePath).toBe(managedPath);
  });

  it("head を強制 refspec で先に fetch する", ({ freshAcquisitionGitRun }) => {
    expect(freshAcquisitionGitRun).toHaveBeenNthCalledWith(1, headFetchInvocation);
  });

  it("fetch の次に登録済み worktree を数え上げる", ({ freshAcquisitionGitRun }) => {
    expect(freshAcquisitionGitRun).toHaveBeenNthCalledWith(2, listInvocation);
  });

  it("数え上げの次に登録簿を掃除する", ({ freshAcquisitionGitRun }) => {
    expect(freshAcquisitionGitRun).toHaveBeenNthCalledWith(3, pruneInvocation);
  });

  it("掃除の次に worktree を作り直す", ({ freshAcquisitionGitRun }) => {
    expect(freshAcquisitionGitRun).toHaveBeenNthCalledWith(4, addInvocation);
  });

  it("作り直しの次に head へ reset して終える", ({ freshAcquisitionGitRun }) => {
    expect(freshAcquisitionGitRun).toHaveBeenNthCalledWith(5, resetInvocation);
  });

  it("新規取得で走る git はこの 5 回だけである", ({ freshAcquisitionGitRun }) => {
    expect(freshAcquisitionGitRun).toHaveBeenCalledTimes(5);
  });

  it("最後に最終使用マーカーを書く", ({ freshAcquisitionMarkerWrite }) => {
    expect(freshAcquisitionMarkerWrite).toHaveBeenCalledExactlyOnceWith(
      managedPath,
      "2026-08-11T00:00:00.000Z",
    );
  });

  it("base ブランチ指定時も head を先に fetch する", ({ baseBranchGitRun }) => {
    expect(baseBranchGitRun).toHaveBeenNthCalledWith(1, headFetchInvocation);
  });

  it("base ブランチ指定時は base も fetch する", ({ baseBranchGitRun }) => {
    expect(baseBranchGitRun).toHaveBeenNthCalledWith(2, baseFetchInvocation);
  });

  it("base が head と同じなら 2 回目の呼び出しは fetch ではない", ({ sameBaseAsHeadGitRun }) => {
    expect(sameBaseAsHeadGitRun).toHaveBeenNthCalledWith(2, listInvocation);
  });

  it("base が head と同じなら走る git は 5 回にとどまる", ({ sameBaseAsHeadGitRun }) => {
    expect(sameBaseAsHeadGitRun).toHaveBeenCalledTimes(5);
  });

  it("登録済みで実体ありなら現在ブランチを問い合わせる", ({ reuseGitRun }) => {
    expect(reuseGitRun).toHaveBeenCalledWith(currentBranchInvocation);
  });

  it("登録済みで同ブランチ・実体ありなら作り直さない", ({ reuseGitRun }) => {
    expect(reuseGitRun).not.toHaveBeenCalledWith(addInvocation);
  });

  it("登録済みで同ブランチ・実体ありなら clean で再利用する", ({ reuseGitRun }) => {
    expect(reuseGitRun).toHaveBeenCalledWith(cleanInvocation);
  });

  it("再利用の reset が失敗したら作り直しへ落ちる", ({ resetFailureGitRun }) => {
    expect(resetFailureGitRun).toHaveBeenCalledWith(addInvocation);
  });

  it("同じ head を別 worktree が持つなら再利用せず作り直す", ({ duplicateHeadGitRun }) => {
    expect(duplicateHeadGitRun).toHaveBeenCalledWith(addInvocation);
  });

  it("登録はあるが実体が無ければ現在ブランチを問い合わせない", ({ missingDirectoryGitRun }) => {
    expect(missingDirectoryGitRun).not.toHaveBeenCalledWith(currentBranchInvocation);
  });

  it("登録はあるが実体が無ければ作り直す", ({ missingDirectoryGitRun }) => {
    expect(missingDirectoryGitRun).toHaveBeenCalledWith(addInvocation);
  });

  it("登録先が別ブランチを持つなら再利用しない", ({ otherBranchGitRun }) => {
    expect(otherBranchGitRun).not.toHaveBeenCalledWith(cleanInvocation);
  });

  it("登録先が別ブランチを持つなら作り直す", ({ otherBranchGitRun }) => {
    expect(otherBranchGitRun).toHaveBeenCalledWith(addInvocation);
  });

  it("作成コマンドが失敗したら元のエラーを投げる", ({ addFailureWithLeftoverSettlement }) => {
    expect(addFailureWithLeftoverSettlement).toStrictEqual([
      { status: "rejected", reason: new Error("add failed") },
    ]);
  });

  it("作成コマンドが失敗し作りかけが残っていれば掃除する", ({ addFailureWithLeftoverRemoval }) => {
    expect(addFailureWithLeftoverRemoval).toHaveBeenCalledWith(managedPath);
  });

  it("作成失敗時に作りかけが残っていなくても元のエラーを投げる", ({
    addFailureWithoutLeftoverSettlement,
  }) => {
    expect(addFailureWithoutLeftoverSettlement).toStrictEqual([
      { status: "rejected", reason: new Error("add failed") },
    ]);
  });

  it("作成失敗時に作りかけが残っていなければ worktree の fs 削除を呼ばない", ({
    addFailureWithoutLeftoverRemoval,
  }) => {
    expect(addFailureWithoutLeftoverRemoval).toHaveBeenCalledExactlyOnceWith(metadataPath);
  });
});
