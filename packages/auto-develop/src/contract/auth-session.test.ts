import { describe, expect, test } from "vite-plus/test";

import { InvalidAuthSessionError, parseAuthSession, serializeAuthSession } from "./auth-session.ts";

describe("serializeAuthSession と parseAuthSession", () => {
  test("producer が作った応答は consumer の検証をそのまま往復する", () => {
    const serialized = serializeAuthSession("session-token", new Date("2030-01-02T03:04:05.000Z"));
    expect(parseAuthSession(serialized)).toStrictEqual({
      token: "session-token",
      expiresAt: "2030-01-02T03:04:05.000Z",
    });
  });
});

describe("parseAuthSession の拒否", () => {
  test("token が欠けていれば拒否する", () => {
    expect(() => parseAuthSession({ expiresAt: "2030-01-02T03:04:05.000Z" })).toThrow(
      InvalidAuthSessionError,
    );
  });

  test("token が空文字列なら拒否する", () => {
    expect(() => parseAuthSession({ token: "", expiresAt: "2030-01-02T03:04:05.000Z" })).toThrow(
      InvalidAuthSessionError,
    );
  });

  test("expiresAt が欠けていれば拒否する", () => {
    expect(() => parseAuthSession({ token: "session-token" })).toThrow(InvalidAuthSessionError);
  });

  test("expiresAt がタイムスタンプとして読めなければ拒否する", () => {
    expect(() => parseAuthSession({ token: "session-token", expiresAt: "someday" })).toThrow(
      InvalidAuthSessionError,
    );
  });

  test("応答がオブジェクトでなければ拒否する", () => {
    expect(() => parseAuthSession("session-token")).toThrow(InvalidAuthSessionError);
  });
});
