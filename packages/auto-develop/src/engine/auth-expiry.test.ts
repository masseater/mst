import { describe, expect, test } from "vite-plus/test";

import { HALT_KEEP_JOB_DISPOSITION } from "../queue/halt-disposition.ts";
import {
  ENGINE_AUTHENTICATION_CODE,
  EngineAuthExpiredError,
  matchedAuthExpiryPattern,
} from "./auth-expiry.ts";

describe("matchedAuthExpiryPattern", () => {
  test("codex のログ前置き込みでも refresh_token_invalidated を拾う", () => {
    const output = '401 Unauthorized: { "code": "refresh_token_invalidated" }';
    expect(matchedAuthExpiryPattern({ engine: "codex", output })).toStrictEqual(
      "refresh_token_invalidated",
    );
  });

  test("codex は文全体ではなくパターン側の部分文字列を返す", () => {
    const output = "ERROR: Your access token could not be refreshed because it was revoked.";
    expect(matchedAuthExpiryPattern({ engine: "codex", output })).toStrictEqual(
      "Your access token could not be refreshed",
    );
  });

  test("claude は定義順の先勝ちで Please run /login を返す", () => {
    expect(
      matchedAuthExpiryPattern({ engine: "claude", output: "Invalid API key · Please run /login" }),
    ).toStrictEqual("Please run /login");
  });

  test("通常のエラー出力は一致なしの null になる", () => {
    expect(
      matchedAuthExpiryPattern({ engine: "claude", output: "quality check failed" }),
    ).toStrictEqual(null);
  });
});

describe("EngineAuthExpiredError", () => {
  test("恒久停止のコードとキュー指示を運ぶ", () => {
    const cause = new Error("process failed");
    const authError = new EngineAuthExpiredError({
      engine: "codex",
      matchedPattern: "token_invalidated",
      cause,
    });
    expect([
      authError.code,
      authError.queueDisposition,
      authError.engine,
      authError.cause,
      authError.message.includes("token_invalidated"),
    ]).toStrictEqual([ENGINE_AUTHENTICATION_CODE, HALT_KEEP_JOB_DISPOSITION, "codex", cause, true]);
  });
});
