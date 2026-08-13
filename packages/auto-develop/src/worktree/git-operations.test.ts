import { describe, expect, test, vi } from "vite-plus/test";

import { createGitOperations } from "./git-operations.ts";

import type { GitRunner } from "./git-runner.ts";

describe("createGitOperations", () => {
  const it = test
    .extend("uncommittedForDirtyStatus", () =>
      createGitOperations({
        git: { run: () => Promise.resolve({ stdout: " M file.ts\n", stderr: "" }) },
        cwd: "/worktree",
      }).hasUncommittedChanges())
    .extend("uncommittedForBlankStatus", () =>
      createGitOperations({
        git: { run: () => Promise.resolve({ stdout: "  \n", stderr: "" }) },
        cwd: "/worktree",
      }).hasUncommittedChanges(),
    )
    .extend("rawPorcelainStatus", () =>
      createGitOperations({
        git: { run: () => Promise.resolve({ stdout: " M file.ts\n?? new.ts\n", stderr: "" }) },
        cwd: "/worktree",
      }).porcelainStatus(),
    )
    .extend("commitAllRunSpy", async () => {
      const commitAllRun = vi.fn<GitRunner["run"]>(() =>
        Promise.resolve({ stdout: "", stderr: "" }),
      );
      await createGitOperations({ git: { run: commitAllRun }, cwd: "/worktree" }).commitAll(
        "fix the tests",
      );
      return commitAllRun;
    })
    .extend("pushRunSpy", async () => {
      const pushRun = vi.fn<GitRunner["run"]>(() => Promise.resolve({ stdout: "", stderr: "" }));
      await createGitOperations({ git: { run: pushRun }, cwd: "/worktree" }).push();
      return pushRun;
    })
    .extend("mergeRemoteBranchRunSpy", async () => {
      const mergeRemoteBranchRun = vi.fn<GitRunner["run"]>(() =>
        Promise.resolve({ stdout: "", stderr: "" }),
      );
      await createGitOperations({
        git: { run: mergeRemoteBranchRun },
        cwd: "/worktree",
      }).mergeRemoteBranch("topic/x");
      return mergeRemoteBranchRun;
    })
    .extend("topLevelFromRelativeOutput", () =>
      createGitOperations({
        git: { run: () => Promise.resolve({ stdout: ".\n", stderr: "" }) },
        cwd: "/worktree",
      }).topLevelPath(),
    )
    .extend("sharedGitDirFromBlankOutput", () =>
      createGitOperations({
        git: { run: () => Promise.resolve({ stdout: "   \n", stderr: "" }) },
        cwd: "/worktree",
      }).sharedGitDirPath(),
    )
    .extend("topLevelAfterFailure", () =>
      createGitOperations({
        git: { run: () => Promise.reject(new Error("git exploded")) },
        cwd: "/worktree",
      }).topLevelPath(),
    )
    .extend("sharedGitDirFromAbsoluteOutput", () =>
      createGitOperations({
        git: { run: () => Promise.resolve({ stdout: "/shared/.git\n", stderr: "" }) },
        cwd: "/worktree",
      }).sharedGitDirPath(),
    );

  it("porcelain 出力が非空なら未コミット変更ありと判定する", ({ uncommittedForDirtyStatus }) => {
    expect(uncommittedForDirtyStatus).toStrictEqual(true);
  });

  it("porcelain 出力が空白のみなら変更なしと判定する", ({ uncommittedForBlankStatus }) => {
    expect(uncommittedForBlankStatus).toStrictEqual(false);
  });

  it("porcelainStatus は出力をそのまま返す", ({ rawPorcelainStatus }) => {
    expect(rawPorcelainStatus).toStrictEqual(" M file.ts\n?? new.ts\n");
  });

  it("commitAll は最初に作業ツリー全体をステージする", ({ commitAllRunSpy }) => {
    expect(commitAllRunSpy).toHaveBeenNthCalledWith(1, {
      args: ["add", "-A"],
      cwd: "/worktree",
    });
  });

  it("commitAll はステージの次にメッセージ付きでコミットする", ({ commitAllRunSpy }) => {
    expect(commitAllRunSpy).toHaveBeenNthCalledWith(2, {
      args: ["commit", "-m", "fix the tests"],
      cwd: "/worktree",
    });
  });

  it("push は origin へ現在の HEAD を送る", ({ pushRunSpy }) => {
    expect(pushRunSpy).toHaveBeenCalledExactlyOnceWith({
      args: ["push", "origin", "HEAD"],
      cwd: "/worktree",
    });
  });

  it("mergeRemoteBranch は最初に対象ブランチを fetch する", ({ mergeRemoteBranchRunSpy }) => {
    expect(mergeRemoteBranchRunSpy).toHaveBeenNthCalledWith(1, {
      args: ["fetch", "origin", "topic/x"],
      cwd: "/worktree",
    });
  });

  it("mergeRemoteBranch は fetch の次に no-ff マージする", ({ mergeRemoteBranchRunSpy }) => {
    expect(mergeRemoteBranchRunSpy).toHaveBeenNthCalledWith(2, {
      args: ["merge", "--no-ff", "origin/topic/x"],
      cwd: "/worktree",
    });
  });

  it("topLevelPath は相対出力を cwd 基準で絶対化する", ({ topLevelFromRelativeOutput }) => {
    expect(topLevelFromRelativeOutput).toStrictEqual("/worktree");
  });

  it("sharedGitDirPath は空白のみの出力を null にする", ({ sharedGitDirFromBlankOutput }) => {
    expect(sharedGitDirFromBlankOutput).toStrictEqual(null);
  });

  it("パス解決はコマンド失敗を null にして例外にしない", ({ topLevelAfterFailure }) => {
    expect(topLevelAfterFailure).toStrictEqual(null);
  });

  it("絶対パス出力はそのまま返る", ({ sharedGitDirFromAbsoluteOutput }) => {
    expect(sharedGitDirFromAbsoluteOutput).toStrictEqual("/shared/.git");
  });
});
