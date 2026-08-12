import { describe, expect, test } from "vite-plus/test";

import { buildClaudeArgs, buildCodexArgs } from "./build-args.ts";

const it = test
  .extend("claudeArgsWithBypass", () =>
    buildClaudeArgs({ prompt: "review this", prNumber: 7, bypassPermissions: true }))
  .extend("claudeArgsWithoutBypass", () =>
    buildClaudeArgs({ prompt: "review this", prNumber: 7, bypassPermissions: false }),
  )
  .extend("codexArgsWithBypass", () =>
    buildCodexArgs({
      prompt: "fix this",
      cwd: "/work/pr-1",
      repoRoot: "/repo",
      sharedGitDir: "/repo/.git",
      bypassPermissions: true,
    }),
  )
  .extend("codexArgsWithoutBypass", () =>
    buildCodexArgs({
      prompt: "fix this",
      cwd: "/work/pr-1",
      repoRoot: null,
      sharedGitDir: null,
      bypassPermissions: false,
    }),
  );

describe("buildClaudeArgs", () => {
  it("バイパス有効時は完全形の引数列になる", ({ claudeArgsWithBypass }) => {
    expect(claudeArgsWithBypass).toStrictEqual([
      "-p",
      "--dangerously-skip-permissions",
      "--name",
      "auto-develop-pr-7",
      "review this",
    ]);
  });

  it("バイパス無効時は permission-mode auto になる", ({ claudeArgsWithoutBypass }) => {
    expect(claudeArgsWithoutBypass).toStrictEqual([
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
  it("バイパス有効時は承認ポリシーが exec の前、全権フラグが exec の後になる", ({
    codexArgsWithBypass,
  }) => {
    expect(codexArgsWithBypass).toStrictEqual([
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

  it("バイパス無効時は on-request と自動レビュアー設定になる", ({ codexArgsWithoutBypass }) => {
    expect(codexArgsWithoutBypass).toStrictEqual([
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
