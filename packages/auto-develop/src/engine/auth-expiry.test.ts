import { describe, expect, test } from "vite-plus/test";

import { EngineAuthExpiredError, matchedAuthExpiryPattern } from "./auth-expiry.ts";

const processFailureCause = new Error("process failed");

describe("matchedAuthExpiryPattern", () => {
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
    );

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
  const it = test
    .extend("theOwnFieldsOfAnExpiredCodexAuthError", () =>
      Object.entries(
        new EngineAuthExpiredError({
          engine: "codex",
          matchedPattern: "token_invalidated",
          cause: processFailureCause,
        }),
      ))
    .extend("theOwnFieldsOfAnExpiredClaudeAuthError", () =>
      Object.entries(
        new EngineAuthExpiredError({
          engine: "claude",
          matchedPattern: "Please run /login",
          cause: processFailureCause,
        }),
      ),
    )
    .extend("theCauseSlotOfAnExpiredCodexAuthError", () =>
      Object.getOwnPropertyDescriptor(
        new EngineAuthExpiredError({
          engine: "codex",
          matchedPattern: "token_invalidated",
          cause: processFailureCause,
        }),
        "cause",
      ),
    )
    .extend("theRenderedTextOfAnExpiredCodexAuthError", () =>
      String(
        new EngineAuthExpiredError({
          engine: "codex",
          matchedPattern: "token_invalidated",
          cause: processFailureCause,
        }),
      ),
    )
    .extend("theRenderedTextOfAnExpiredClaudeAuthError", () =>
      String(
        new EngineAuthExpiredError({
          engine: "claude",
          matchedPattern: "Please run /login",
          cause: processFailureCause,
        }),
      ),
    );

  it("codex の失効は恒久停止の処分指示と識別子を並べて運ぶ", ({
    theOwnFieldsOfAnExpiredCodexAuthError,
  }) => {
    expect(theOwnFieldsOfAnExpiredCodexAuthError).toStrictEqual([
      ["name", "EngineAuthExpiredError"],
      ["queueDisposition", "halt-keep-job"],
      ["code", "engine_authentication"],
      ["engine", "codex"],
      ["matchedPattern", "token_invalidated"],
    ]);
  });

  it("claude の失効も同じ並びでエンジン名と一致パターンだけを替えて運ぶ", ({
    theOwnFieldsOfAnExpiredClaudeAuthError,
  }) => {
    expect(theOwnFieldsOfAnExpiredClaudeAuthError).toStrictEqual([
      ["name", "EngineAuthExpiredError"],
      ["queueDisposition", "halt-keep-job"],
      ["code", "engine_authentication"],
      ["engine", "claude"],
      ["matchedPattern", "Please run /login"],
    ]);
  });

  it("元の失敗を列挙されない cause の枠に収める", ({ theCauseSlotOfAnExpiredCodexAuthError }) => {
    expect(theCauseSlotOfAnExpiredCodexAuthError).toStrictEqual({
      value: processFailureCause,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  });

  it("codex 向けの文面は一致パターンと再ログイン先を名指しする", ({
    theRenderedTextOfAnExpiredCodexAuthError,
  }) => {
    expect(theRenderedTextOfAnExpiredCodexAuthError).toStrictEqual(
      'EngineAuthExpiredError: codex authentication expired (matched "token_invalidated"); re-login to the codex CLI on the host and restart — the next startup drain re-derives work from the current GitHub state',
    );
  });

  it("claude 向けの文面は再ログイン先を claude に差し替える", ({
    theRenderedTextOfAnExpiredClaudeAuthError,
  }) => {
    expect(theRenderedTextOfAnExpiredClaudeAuthError).toStrictEqual(
      'EngineAuthExpiredError: claude authentication expired (matched "Please run /login"); re-login to the claude CLI on the host and restart — the next startup drain re-derives work from the current GitHub state',
    );
  });
});
