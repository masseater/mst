import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger, type Logger } from "../logging/logger.ts";
import { worktreePathFor } from "./paths.ts";
import { removeWorktree } from "./remove-worktree.ts";

import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

const managedPath = worktreePathFor(7);

describe("removeWorktree", () => {
  const it = test
    .extend("gitRunUnderUnmanagedPath", async () => {
      const runGit = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await removeWorktree({
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
        },
        worktreePath: "/tmp/elsewhere/pr-7",
      });
      return runGit;
    })
    .extend("directoryRemovalUnderUnmanagedPath", async () => {
      const removeDirectory = vi.fn<WorktreeFs["removeRecursive"]>();
      await removeWorktree({
        context: {
          git: { run: () => Promise.resolve({ stdout: "", stderr: "" }) },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: removeDirectory,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
        },
        worktreePath: "/tmp/elsewhere/pr-7",
      });
      return removeDirectory;
    })
    .extend("gitRunUnderRepositoryRoot", async () => {
      const runGit = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await removeWorktree({
        context: {
          git: { run: runGit },
          repoDir: managedPath,
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
        },
        worktreePath: managedPath,
      });
      return runGit;
    })
    .extend("gitRunUnderMissingDirectory", async () => {
      const runGit = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await removeWorktree({
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
        },
        worktreePath: managedPath,
      });
      return runGit;
    })
    .extend("gitRunUnderProtectedBranch", async () => {
      const runGit = vi.fn<GitRunner["run"]>((invocation) =>
        Promise.resolve({
          stdout: invocation.args.includes("--short") ? "main\n" : "refs/remotes/origin/main\n",
          stderr: "",
        }),
      );
      await removeWorktree({
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
        },
        worktreePath: managedPath,
      });
      return runGit;
    })
    .extend("directoryRemovalUnderProtectedBranch", async () => {
      const removeDirectory = vi.fn<WorktreeFs["removeRecursive"]>();
      await removeWorktree({
        context: {
          git: {
            run: (invocation) =>
              Promise.resolve({
                stdout: invocation.args.includes("--short")
                  ? "main\n"
                  : "refs/remotes/origin/main\n",
                stderr: "",
              }),
          },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: removeDirectory,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
        },
        worktreePath: managedPath,
      });
      return removeDirectory;
    })
    .extend("gitRunUnderNormalRemoval", async () => {
      const runGit = vi.fn<GitRunner["run"]>((invocation) =>
        Promise.resolve({
          stdout: invocation.args.includes("--short") ? "topic/x\n" : "refs/remotes/origin/main\n",
          stderr: "",
        }),
      );
      await removeWorktree({
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
        },
        worktreePath: managedPath,
      });
      return runGit;
    })
    .extend("directoryRemovalUnderNotAWorkingTree", async () => {
      const removeDirectory = vi.fn<WorktreeFs["removeRecursive"]>();
      await removeWorktree({
        context: {
          git: {
            run: (invocation) =>
              invocation.args.includes("remove")
                ? Promise.reject(new Error("fatal: 'x' is not a working tree"))
                : Promise.resolve({
                    stdout: invocation.args.includes("--short")
                      ? "topic/x\n"
                      : "refs/remotes/origin/main\n",
                    stderr: "",
                  }),
          },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => removeDirectory.mock.calls.length === 0,
            removeRecursive: removeDirectory,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: silentLogger,
        },
        worktreePath: managedPath,
      });
      return removeDirectory;
    })
    .extend("propagatedGitFailure", async () => {
      try {
        await removeWorktree({
          context: {
            git: {
              run: (invocation) =>
                invocation.args.includes("remove")
                  ? Promise.reject(new Error("disk full"))
                  : Promise.resolve({
                      stdout: invocation.args.includes("--short")
                        ? "topic/x\n"
                        : "refs/remotes/origin/main\n",
                      stderr: "",
                    }),
            },
            repoDir: "/repo",
            sharedGitDir: "/repo/.git",
            fs: {
              exists: () => true,
              removeRecursive: () => undefined,
              writeMarker: () => undefined,
              markerMtimeMs: () => null,
            },
            log: silentLogger,
          },
          worktreePath: managedPath,
        });
      } catch (removalFailure) {
        return removalFailure;
      }
      throw new Error("removeWorktree swallowed the git failure instead of propagating it");
    })
    .extend("warningUnderPruneFailure", async () => {
      const warnOfFailure = vi.fn<Logger["warn"]>();
      await removeWorktree({
        context: {
          git: {
            run: (invocation) =>
              invocation.args.includes("prune")
                ? Promise.reject(new Error("prune broke"))
                : Promise.resolve({
                    stdout: invocation.args.includes("--short")
                      ? "topic/x\n"
                      : "refs/remotes/origin/main\n",
                    stderr: "",
                  }),
          },
          repoDir: "/repo",
          sharedGitDir: "/repo/.git",
          fs: {
            exists: () => true,
            removeRecursive: () => undefined,
            writeMarker: () => undefined,
            markerMtimeMs: () => null,
          },
          log: { ...silentLogger, warn: warnOfFailure },
        },
        worktreePath: managedPath,
      });
      return warnOfFailure;
    });

  it("管理外のパスには git を触らない", ({ gitRunUnderUnmanagedPath }) => {
    expect(gitRunUnderUnmanagedPath).not.toHaveBeenCalled();
  });

  it("管理外のパスにはディレクトリ削除も行わない", ({ directoryRemovalUnderUnmanagedPath }) => {
    expect(directoryRemovalUnderUnmanagedPath).not.toHaveBeenCalled();
  });

  it("リポジトリルートと同一のパスには git を触らない", ({ gitRunUnderRepositoryRoot }) => {
    expect(gitRunUnderRepositoryRoot).not.toHaveBeenCalled();
  });

  it("ディレクトリが無ければメタデータ掃除だけ行う", ({ gitRunUnderMissingDirectory }) => {
    expect(gitRunUnderMissingDirectory).toHaveBeenCalledExactlyOnceWith({
      args: ["worktree", "prune"],
      cwd: "/repo",
    });
  });

  it("保護ブランチではブランチ解決の 2 回しか git を呼ばない", ({ gitRunUnderProtectedBranch }) => {
    expect(gitRunUnderProtectedBranch).toHaveBeenCalledTimes(2);
  });

  it("保護ブランチでは現在ブランチを worktree のパスで解決する", ({
    gitRunUnderProtectedBranch,
  }) => {
    expect(gitRunUnderProtectedBranch).toHaveBeenNthCalledWith(1, {
      args: ["symbolic-ref", "--short", "HEAD"],
      cwd: managedPath,
    });
  });

  it("保護ブランチでは既定ブランチをリポジトリのパスで解決する", ({
    gitRunUnderProtectedBranch,
  }) => {
    expect(gitRunUnderProtectedBranch).toHaveBeenNthCalledWith(2, {
      args: ["symbolic-ref", "refs/remotes/origin/HEAD"],
      cwd: "/repo",
    });
  });

  it("保護ブランチ上の worktree はディレクトリ削除も行わない", ({
    directoryRemovalUnderProtectedBranch,
  }) => {
    expect(directoryRemovalUnderProtectedBranch).not.toHaveBeenCalled();
  });

  it("通常の削除はブランチ解決と削除と掃除の 4 回で済ませる", ({ gitRunUnderNormalRemoval }) => {
    expect(gitRunUnderNormalRemoval).toHaveBeenCalledTimes(4);
  });

  it("通常の削除は二重強制で worktree を外す", ({ gitRunUnderNormalRemoval }) => {
    expect(gitRunUnderNormalRemoval).toHaveBeenNthCalledWith(3, {
      args: ["worktree", "remove", "--force", "--force", managedPath],
      cwd: "/repo",
    });
  });

  it("通常の削除は最後にメタデータを掃除する", ({ gitRunUnderNormalRemoval }) => {
    expect(gitRunUnderNormalRemoval).toHaveBeenNthCalledWith(4, {
      args: ["worktree", "prune"],
      cwd: "/repo",
    });
  });

  it("git が working tree でないと言えば 2 か所を消す", ({
    directoryRemovalUnderNotAWorkingTree,
  }) => {
    expect(directoryRemovalUnderNotAWorkingTree).toHaveBeenCalledTimes(2);
  });

  it("git が working tree でないと言えば worktree のパスを消す", ({
    directoryRemovalUnderNotAWorkingTree,
  }) => {
    expect(directoryRemovalUnderNotAWorkingTree).toHaveBeenNthCalledWith(1, managedPath);
  });

  it("git が working tree でないと言えば共有 git ディレクトリの記録も消す", ({
    directoryRemovalUnderNotAWorkingTree,
  }) => {
    expect(directoryRemovalUnderNotAWorkingTree).toHaveBeenNthCalledWith(
      2,
      "/repo/.git/worktrees/pr-7",
    );
  });

  it("それ以外の git 失敗は例外として伝播する", ({ propagatedGitFailure }) => {
    expect(propagatedGitFailure).toStrictEqual(new Error("disk full"));
  });

  it("prune の失敗は警告のみで全体を止めない", ({ warningUnderPruneFailure }) => {
    expect(warningUnderPruneFailure).toHaveBeenCalledExactlyOnceWith(
      { err: new Error("prune broke") },
      "worktree prune failed",
    );
  });
});
