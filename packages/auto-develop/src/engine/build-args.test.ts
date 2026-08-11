import { describe, expect, test } from "vite-plus/test";

import { buildClaudeArgs, buildCodexArgs } from "./build-args.ts";

describe("buildClaudeArgs", () => {
  test("バイパス有効時は完全形の引数列になる", () => {
    expect(
      buildClaudeArgs({ prompt: "review this", prNumber: 7, bypassPermissions: true }),
    ).toStrictEqual([
      "-p",
      "--dangerously-skip-permissions",
      "--name",
      "auto-develop-pr-7",
      "review this",
    ]);
  });

  test("バイパス無効時は permission-mode auto になる", () => {
    expect(
      buildClaudeArgs({ prompt: "review this", prNumber: 7, bypassPermissions: false }),
    ).toStrictEqual([
      "-p",
      "--permission-mode",
      "auto",
      "--name",
      "auto-develop-pr-7",
      "review this",
    ]);
  });
});

describe("buildCodexArgs", () => {
  test("バイパス有効時は承認ポリシーが exec の前、全権フラグが exec の後になる", () => {
    expect(
      buildCodexArgs({
        prompt: "fix this",
        cwd: "/work/pr-1",
        repoRoot: "/repo",
        sharedGitDir: "/repo/.git",
        bypassPermissions: true,
      }),
    ).toStrictEqual([
      "-a",
      "never",
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "-C",
      "/work/pr-1",
      "--add-dir",
      "/repo",
      "--add-dir",
      "/repo/.git",
      "fix this",
    ]);
  });

  test("バイパス無効時は on-request と自動レビュアー設定になる", () => {
    expect(
      buildCodexArgs({
        prompt: "fix this",
        cwd: "/work/pr-1",
        repoRoot: null,
        sharedGitDir: null,
        bypassPermissions: false,
      }),
    ).toStrictEqual([
      "-a",
      "on-request",
      "-c",
      'approvals_reviewer="auto_review"',
      "exec",
      "-C",
      "/work/pr-1",
      "fix this",
    ]);
  });
});
