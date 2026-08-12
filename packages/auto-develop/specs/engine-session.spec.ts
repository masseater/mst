import { describe, expect, it } from "vite-plus/test";

import { buildPrompt } from "../src/context/prompt.ts";
import { matchedAuthExpiryPattern } from "../src/engine/auth-expiry.ts";
import { buildClaudeArgs, buildCodexArgs } from "../src/engine/build-args.ts";
import { engineSessionName } from "../src/engine/session-name.ts";

describe("エンジンは PR ごとの仮想端末セッションで動く", () => {
  it("セッション名は PR 番号から決まる", () => {
    expect(engineSessionName(7)).toStrictEqual("auto-develop-pr-7");
  });

  it("権限の確認を外す指定は明示したときだけ引数に現れる", () => {
    expect(
      buildClaudeArgs({ prompt: "review", prNumber: 7, bypassPermissions: false }),
    ).not.toContain("--dangerously-skip-permissions");
  });

  it("書き込みを許すディレクトリはリポジトリルートと共通 git ディレクトリに限る", () => {
    expect(
      buildCodexArgs({
        prompt: "fix",
        cwd: "/work/pr-1",
        repoRoot: "/repo",
        sharedGitDir: "/repo/.git",
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
      "--add-dir",
      "/repo",
      "--add-dir",
      "/repo/.git",
      "fix",
    ]);
  });

  it("作業ディレクトリと同じルートは許可対象から外す", () => {
    expect(
      buildCodexArgs({
        prompt: "fix",
        cwd: "/work/pr-1",
        repoRoot: "/work/pr-1",
        sharedGitDir: null,
        bypassPermissions: false,
      }),
    ).not.toContain("--add-dir");
  });

  it("起動プロンプトに diff を埋め込まない", () => {
    expect(
      buildPrompt({
        engine: "claude",
        mode: "reviewer",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
      }),
    ).toContain("not passed inline");
  });

  it("起動プロンプトは実行コンテキストの場所だけを伝える", () => {
    expect(
      buildPrompt({
        engine: "claude",
        mode: "reviewer",
        prNumber: 7,
        baseRef: "main",
        headRef: "topic/x",
        runContextJsonPath: "/work/run-context.json",
      }),
    ).toContain("Run context: /work/run-context.json");
  });

  it("エンジンの認証失効は出力の文言から見分ける", () => {
    expect(
      matchedAuthExpiryPattern({ engine: "codex", output: "ERROR: token_invalidated" }),
    ).toStrictEqual("token_invalidated");
  });

  it("通常の失敗出力は認証失効と見分けられる", () => {
    expect(
      matchedAuthExpiryPattern({ engine: "claude", output: "quality check failed" }),
    ).toStrictEqual(null);
  });
});
