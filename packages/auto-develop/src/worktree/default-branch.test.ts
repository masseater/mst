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

describe("resolveDefaultBranch", () => {
  test("origin/HEAD の symbolic-ref から接頭辞を剥がして返す", async () => {
    const branch = await resolveDefaultBranch({
      git: gitReturning("refs/remotes/origin/develop\n"),
      repoDir: "/repo",
      log: silentLogger,
    });
    expect(branch).toStrictEqual("develop");
  });

  test("出力が空なら既定値 main に落ちる", async () => {
    const branch = await resolveDefaultBranch({
      git: gitReturning("  \n"),
      repoDir: "/repo",
      log: silentLogger,
    });
    expect(branch).toStrictEqual("main");
  });

  test("解決に失敗したら null を返す", async () => {
    const branch = await resolveDefaultBranch({
      git: gitFailing("no origin/HEAD"),
      repoDir: "/repo",
      log: silentLogger,
    });
    expect(branch).toStrictEqual(null);
  });
});

describe("resolveCurrentBranch", () => {
  test("symbolic-ref の出力をそのまま現在ブランチにする", async () => {
    const branch = await resolveCurrentBranch({
      git: gitReturning("topic/x\n"),
      worktreePath: "/worktree",
      log: silentLogger,
    });
    expect(branch).toStrictEqual("topic/x");
  });

  test("空の出力はブランチ不明 null になる", async () => {
    const branch = await resolveCurrentBranch({
      git: gitReturning("  \n"),
      worktreePath: "/worktree",
      log: silentLogger,
    });
    expect(branch).toStrictEqual(null);
  });

  test("detached HEAD の失敗は null と同じ扱いになる", async () => {
    const branch = await resolveCurrentBranch({
      git: gitFailing("fatal: ref HEAD is not a symbolic ref"),
      worktreePath: "/worktree",
      log: silentLogger,
    });
    expect(branch).toStrictEqual(null);
  });

  test("予期しない失敗は不明マーカーになる", async () => {
    const branch = await resolveCurrentBranch({
      git: gitFailing("unexpected git failure"),
      worktreePath: "/worktree",
      log: silentLogger,
    });
    expect(branch).toStrictEqual(UNKNOWN_BRANCH_MARKER);
  });
});
