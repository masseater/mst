import { describe, expect, test, vi } from "vite-plus/test";

import { createGitOperations } from "./git-operations.ts";

import type { GitRunner } from "./git-runner.ts";

const scriptedGit = (
  producedByCommand: Readonly<
    Record<string, { readonly stdout?: string; readonly fail?: boolean }>
  >,
): { readonly git: GitRunner; readonly calls: () => readonly string[] } => {
  const recorded = new Map<number, string>();
  const git: GitRunner = {
    run: (invocation) => {
      const named = invocation.args.join(" ");
      recorded.set(recorded.size, named);
      const scriptedOutput = producedByCommand[named];
      if (scriptedOutput?.fail === true) return Promise.reject(new Error(`git failed: ${named}`));
      return Promise.resolve({ stdout: scriptedOutput?.stdout ?? "", stderr: "" });
    },
  };
  return { git, calls: () => [...recorded.values()] };
};

const it = test
  .extend("uncommittedForDirtyStatus", () => {
    const { git } = scriptedGit({ "status --porcelain": { stdout: " M file.ts\n" } });
    return createGitOperations({ git, cwd: "/worktree" }).hasUncommittedChanges();
  })
  .extend("uncommittedForBlankStatus", () => {
    const { git } = scriptedGit({ "status --porcelain": { stdout: "  \n" } });
    return createGitOperations({ git, cwd: "/worktree" }).hasUncommittedChanges();
  })
  .extend("rawPorcelainStatus", () => {
    const { git } = scriptedGit({ "status --porcelain": { stdout: " M file.ts\n?? new.ts\n" } });
    return createGitOperations({ git, cwd: "/worktree" }).porcelainStatus();
  })
  .extend("commitAllCalls", async () => {
    const { git, calls } = scriptedGit({});
    await createGitOperations({ git, cwd: "/worktree" }).commitAll("fix the tests");
    return calls();
  })
  .extend("pushCalls", async () => {
    const { git, calls } = scriptedGit({});
    await createGitOperations({ git, cwd: "/worktree" }).push();
    return calls();
  })
  .extend("mergeRemoteBranchCalls", async () => {
    const { git, calls } = scriptedGit({});
    await createGitOperations({ git, cwd: "/worktree" }).mergeRemoteBranch("topic/x");
    return calls();
  })
  .extend("topLevelFromRelativeOutput", () => {
    const { git } = scriptedGit({ "rev-parse --show-toplevel": { stdout: ".\n" } });
    return createGitOperations({ git, cwd: "/worktree" }).topLevelPath();
  })
  .extend("sharedGitDirFromBlankOutput", () => {
    const { git } = scriptedGit({ "rev-parse --git-common-dir": { stdout: "   \n" } });
    return createGitOperations({ git, cwd: "/worktree" }).sharedGitDirPath();
  })
  .extend("topLevelAfterFailure", () => {
    const failingGit: GitRunner = { run: () => Promise.reject(new Error("git exploded")) };
    return createGitOperations({ git: failingGit, cwd: "/worktree" }).topLevelPath();
  })
  .extend("sharedGitDirFromAbsoluteOutput", () => {
    const runSpy = vi.fn<GitRunner["run"]>(() =>
      Promise.resolve({ stdout: "/shared/.git\n", stderr: "" }),
    );
    return createGitOperations({ git: { run: runSpy }, cwd: "/worktree" }).sharedGitDirPath();
  });

describe("createGitOperations", () => {
  it("porcelain 出力が非空なら未コミット変更ありと判定する", ({ uncommittedForDirtyStatus }) => {
    expect(uncommittedForDirtyStatus).toStrictEqual(true);
  });

  it("porcelain 出力が空白のみなら変更なしと判定する", ({ uncommittedForBlankStatus }) => {
    expect(uncommittedForBlankStatus).toStrictEqual(false);
  });

  it("porcelainStatus は出力をそのまま返す", ({ rawPorcelainStatus }) => {
    expect(rawPorcelainStatus).toStrictEqual(" M file.ts\n?? new.ts\n");
  });

  it("commitAll は全ステージしてからメッセージ付きコミットする", ({ commitAllCalls }) => {
    expect(commitAllCalls).toStrictEqual(["add -A", "commit -m fix the tests"]);
  });

  it("push は origin へ現在の HEAD を送る", ({ pushCalls }) => {
    expect(pushCalls).toStrictEqual(["push origin HEAD"]);
  });

  it("mergeRemoteBranch は fetch してから no-ff マージする", ({ mergeRemoteBranchCalls }) => {
    expect(mergeRemoteBranchCalls).toStrictEqual([
      "fetch origin topic/x",
      "merge --no-ff origin/topic/x",
    ]);
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
