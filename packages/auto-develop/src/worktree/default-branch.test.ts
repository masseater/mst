import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { resolveCurrentBranch, resolveDefaultBranch } from "./default-branch.ts";
import { UNKNOWN_BRANCH_MARKER } from "./protected-branch.ts";

import type { GitRunner } from "./git-runner.ts";

const gitReturning = (stdout: string): GitRunner => ({
  run: () => Promise.resolve({ stdout, stderr: "" }),
});

const gitFailing = (message: string): GitRunner => ({
  run: () => Promise.reject(new Error(message)),
});

class GitStderrError extends Error {
  readonly stderr: string;

  constructor(stderr: string) {
    super("git failed");
    this.stderr = stderr;
  }
}

const gitFailingWithStderr = (stderr: string): GitRunner => ({
  run: () => Promise.reject(new GitStderrError(stderr)),
});

const it = test
  .extend("defaultBranchFromSymbolicRef", () =>
    resolveDefaultBranch({
      git: gitReturning("refs/remotes/origin/develop\n"),
      repoDir: "/repo",
      log: silentLogger,
    }))
  .extend("defaultBranchFromBlankOutput", () =>
    resolveDefaultBranch({
      git: gitReturning("  \n"),
      repoDir: "/repo",
      log: silentLogger,
    }),
  )
  .extend("defaultBranchAfterFailure", () =>
    resolveDefaultBranch({
      git: gitFailing("no origin/HEAD"),
      repoDir: "/repo",
      log: silentLogger,
    }),
  )
  .extend("currentBranchFromSymbolicRef", () =>
    resolveCurrentBranch({
      git: gitReturning("topic/x\n"),
      worktreePath: "/worktree",
      log: silentLogger,
    }),
  )
  .extend("currentBranchFromBlankOutput", () =>
    resolveCurrentBranch({
      git: gitReturning("  \n"),
      worktreePath: "/worktree",
      log: silentLogger,
    }),
  )
  .extend("currentBranchAfterDetachedFailure", () =>
    resolveCurrentBranch({
      git: gitFailing("fatal: ref HEAD is not a symbolic ref"),
      worktreePath: "/worktree",
      log: silentLogger,
    }),
  )
  .extend("currentBranchAfterDetachedStderr", () =>
    resolveCurrentBranch({
      git: gitFailingWithStderr("fatal: ref HEAD is not a symbolic ref"),
      worktreePath: "/worktree",
      log: silentLogger,
    }),
  )
  .extend("currentBranchAfterUnexpectedFailure", () =>
    resolveCurrentBranch({
      git: gitFailing("unexpected git failure"),
      worktreePath: "/worktree",
      log: silentLogger,
    }),
  );

describe("resolveDefaultBranch", () => {
  it("origin/HEAD の symbolic-ref から接頭辞を剥がして返す", ({ defaultBranchFromSymbolicRef }) => {
    expect(defaultBranchFromSymbolicRef).toStrictEqual("develop");
  });

  it("出力が空なら既定値 main に落ちる", ({ defaultBranchFromBlankOutput }) => {
    expect(defaultBranchFromBlankOutput).toStrictEqual("main");
  });

  it("解決に失敗したら null を返す", ({ defaultBranchAfterFailure }) => {
    expect(defaultBranchAfterFailure).toStrictEqual(null);
  });
});

describe("resolveCurrentBranch", () => {
  it("symbolic-ref の出力をそのまま現在ブランチにする", ({ currentBranchFromSymbolicRef }) => {
    expect(currentBranchFromSymbolicRef).toStrictEqual("topic/x");
  });

  it("空の出力はブランチ不明 null になる", ({ currentBranchFromBlankOutput }) => {
    expect(currentBranchFromBlankOutput).toStrictEqual(null);
  });

  it("detached HEAD の失敗は null と同じ扱いになる", ({ currentBranchAfterDetachedFailure }) => {
    expect(currentBranchAfterDetachedFailure).toStrictEqual(null);
  });

  it("detached の判定は失敗の stderr プロパティからも行う", ({
    currentBranchAfterDetachedStderr,
  }) => {
    expect(currentBranchAfterDetachedStderr).toStrictEqual(null);
  });

  it("予期しない失敗は不明マーカーになる", ({ currentBranchAfterUnexpectedFailure }) => {
    expect(currentBranchAfterUnexpectedFailure).toStrictEqual(UNKNOWN_BRANCH_MARKER);
  });
});
