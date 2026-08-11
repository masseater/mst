import { describe, expect, test, vi } from "vite-plus/test";

import { createGitOperations } from "./git-operations.ts";

import type { GitRunner } from "./git-runner.ts";

const scriptedGit = (
  outputs: Readonly<Record<string, { readonly stdout?: string; readonly fail?: boolean }>>,
): { readonly git: GitRunner; readonly calls: () => readonly string[] } => {
  const recorded = new Map<number, string>();
  const git: GitRunner = {
    run: (invocation) => {
      const key = invocation.args.join(" ");
      recorded.set(recorded.size, key);
      const scriptedOutput = outputs[key];
      if (scriptedOutput?.fail === true) return Promise.reject(new Error(`git failed: ${key}`));
      return Promise.resolve({ stdout: scriptedOutput?.stdout ?? "", stderr: "" });
    },
  };
  return { git, calls: () => [...recorded.values()] };
};

describe("createGitOperations", () => {
  test("porcelain 出力が非空なら未コミット変更ありと判定する", async () => {
    const { git } = scriptedGit({ "status --porcelain": { stdout: " M file.ts\n" } });
    const operations = createGitOperations({ git, cwd: "/worktree" });
    expect(await operations.hasUncommittedChanges()).toStrictEqual(true);
  });

  test("porcelain 出力が空白のみなら変更なしと判定する", async () => {
    const { git } = scriptedGit({ "status --porcelain": { stdout: "  \n" } });
    const operations = createGitOperations({ git, cwd: "/worktree" });
    expect(await operations.hasUncommittedChanges()).toStrictEqual(false);
  });

  test("porcelainStatus は出力をそのまま返す", async () => {
    const { git } = scriptedGit({ "status --porcelain": { stdout: " M file.ts\n?? new.ts\n" } });
    const operations = createGitOperations({ git, cwd: "/worktree" });
    expect(await operations.porcelainStatus()).toStrictEqual(" M file.ts\n?? new.ts\n");
  });

  test("commitAll は全ステージしてからメッセージ付きコミットする", async () => {
    const { git, calls } = scriptedGit({});
    const operations = createGitOperations({ git, cwd: "/worktree" });
    await operations.commitAll("fix the tests");
    expect(calls()).toStrictEqual(["add -A", "commit -m fix the tests"]);
  });

  test("push は origin へ現在の HEAD を送る", async () => {
    const { git, calls } = scriptedGit({});
    const operations = createGitOperations({ git, cwd: "/worktree" });
    await operations.push();
    expect(calls()).toStrictEqual(["push origin HEAD"]);
  });

  test("mergeRemoteBranch は fetch してから no-ff マージする", async () => {
    const { git, calls } = scriptedGit({});
    const operations = createGitOperations({ git, cwd: "/worktree" });
    await operations.mergeRemoteBranch("topic/x");
    expect(calls()).toStrictEqual(["fetch origin topic/x", "merge --no-ff origin/topic/x"]);
  });

  test("topLevelPath は相対出力を cwd 基準で絶対化する", async () => {
    const { git } = scriptedGit({ "rev-parse --show-toplevel": { stdout: ".\n" } });
    const operations = createGitOperations({ git, cwd: "/worktree" });
    expect(await operations.topLevelPath()).toStrictEqual("/worktree");
  });

  test("sharedGitDirPath は空白のみの出力を null にする", async () => {
    const { git } = scriptedGit({ "rev-parse --git-common-dir": { stdout: "   \n" } });
    const operations = createGitOperations({ git, cwd: "/worktree" });
    expect(await operations.sharedGitDirPath()).toStrictEqual(null);
  });

  test("パス解決はコマンド失敗を null にして例外にしない", async () => {
    const failingGit: GitRunner = { run: () => Promise.reject(new Error("git exploded")) };
    const operations = createGitOperations({ git: failingGit, cwd: "/worktree" });
    expect(await operations.topLevelPath()).toStrictEqual(null);
  });

  test("絶対パス出力はそのまま返る", async () => {
    const runSpy = vi.fn<GitRunner["run"]>(() =>
      Promise.resolve({ stdout: "/shared/.git\n", stderr: "" }),
    );
    const operations = createGitOperations({ git: { run: runSpy }, cwd: "/worktree" });
    expect(await operations.sharedGitDirPath()).toStrictEqual("/shared/.git");
  });
});
