import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { resolveCurrentBranch, resolveDefaultBranch } from "./default-branch.ts";
import { UNKNOWN_BRANCH_MARKER } from "./protected-branch.ts";

describe("resolveDefaultBranch", () => {
  const it = test
    .extend("defaultBranchFromSymbolicRef", () =>
      resolveDefaultBranch({
        git: {
          run: () => Promise.resolve({ stdout: "refs/remotes/origin/develop\n", stderr: "" }),
        },
        repoDir: "/repo",
        log: silentLogger,
      }))
    .extend("defaultBranchFromBlankOutput", () =>
      resolveDefaultBranch({
        git: {
          run: () => Promise.resolve({ stdout: "  \n", stderr: "" }),
        },
        repoDir: "/repo",
        log: silentLogger,
      }),
    )
    .extend("defaultBranchAfterFailure", () =>
      resolveDefaultBranch({
        git: {
          run: () => Promise.reject(new Error("no origin/HEAD")),
        },
        repoDir: "/repo",
        log: silentLogger,
      }),
    );

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
  const it = test
    .extend("currentBranchFromSymbolicRef", () =>
      resolveCurrentBranch({
        git: {
          run: () => Promise.resolve({ stdout: "topic/x\n", stderr: "" }),
        },
        worktreePath: "/worktree",
        log: silentLogger,
      }))
    .extend("currentBranchFromBlankOutput", () =>
      resolveCurrentBranch({
        git: {
          run: () => Promise.resolve({ stdout: "  \n", stderr: "" }),
        },
        worktreePath: "/worktree",
        log: silentLogger,
      }),
    )
    .extend("currentBranchAfterDetachedFailure", () =>
      resolveCurrentBranch({
        git: {
          run: () => Promise.reject(new Error("fatal: ref HEAD is not a symbolic ref")),
        },
        worktreePath: "/worktree",
        log: silentLogger,
      }),
    )
    .extend("currentBranchAfterDetachedStderr", () => {
      class GitFailureCarryingStderr extends Error {
        readonly stderr = "fatal: ref HEAD is not a symbolic ref";
      }

      return resolveCurrentBranch({
        git: {
          run: () => Promise.reject(new GitFailureCarryingStderr("git failed")),
        },
        worktreePath: "/worktree",
        log: silentLogger,
      });
    })
    .extend("currentBranchAfterUnexpectedFailure", () =>
      resolveCurrentBranch({
        git: {
          run: () => Promise.reject(new Error("unexpected git failure")),
        },
        worktreePath: "/worktree",
        log: silentLogger,
      }),
    );

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
