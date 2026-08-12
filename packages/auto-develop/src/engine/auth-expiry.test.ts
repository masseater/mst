import { describe, expect, test } from "vite-plus/test";

import { EngineAuthExpiredError, matchedAuthExpiryPattern } from "./auth-expiry.ts";

const processFailureCause = new Error("process failed");

const it = test
  .extend("codexInvalidatedMatch", () =>
    matchedAuthExpiryPattern({
      engine: "codex",
      output: '401 Unauthorized: { "code": "refresh_token_invalidated" }',
    }))
  .extend("codexRevokedMatch", () =>
    matchedAuthExpiryPattern({
      engine: "codex",
      output: "ERROR: Your access token could not be refreshed because it was revoked.",
    }),
  )
  .extend("claudeLoginMatch", () =>
    matchedAuthExpiryPattern({ engine: "claude", output: "Invalid API key · Please run /login" }),
  )
  .extend("unrelatedOutputMatch", () =>
    matchedAuthExpiryPattern({ engine: "claude", output: "quality check failed" }),
  )
  .extend(
    "expiredAuthError",
    () =>
      new EngineAuthExpiredError({
        engine: "codex",
        matchedPattern: "token_invalidated",
        cause: processFailureCause,
      }),
  );

describe("matchedAuthExpiryPattern", () => {
  it("codex のログ前置き込みでも refresh_token_invalidated を拾う", ({ codexInvalidatedMatch }) => {
    expect(codexInvalidatedMatch).toStrictEqual("refresh_token_invalidated");
  });

  it("codex は文全体ではなくパターン側の部分文字列を返す", ({ codexRevokedMatch }) => {
    expect(codexRevokedMatch).toStrictEqual("Your access token could not be refreshed");
  });

  it("claude は定義順の先勝ちで Please run /login を返す", ({ claudeLoginMatch }) => {
    expect(claudeLoginMatch).toStrictEqual("Please run /login");
  });

  it("通常のエラー出力は一致なしの null になる", ({ unrelatedOutputMatch }) => {
    expect(unrelatedOutputMatch).toStrictEqual(null);
  });
});

describe("EngineAuthExpiredError", () => {
  it("恒久停止のコードを運ぶ", ({ expiredAuthError }) => {
    expect(expiredAuthError.code).toStrictEqual("engine_authentication");
  });

  it("キュー指示を運ぶ", ({ expiredAuthError }) => {
    expect(expiredAuthError.queueDisposition).toStrictEqual("halt-keep-job");
  });

  it("エンジン名を運ぶ", ({ expiredAuthError }) => {
    expect(expiredAuthError.engine).toStrictEqual("codex");
  });

  it("元の失敗を cause として運ぶ", ({ expiredAuthError }) => {
    expect(expiredAuthError.cause).toStrictEqual(processFailureCause);
  });

  it("メッセージに一致したパターンを含む", ({ expiredAuthError }) => {
    expect(expiredAuthError.message).toContain("token_invalidated");
  });
});
