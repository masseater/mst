import { describe, expect, test } from "vite-plus/test";

import { parseAuthSession, serializeAuthSession } from "./auth-session.ts";

const rejectionNameOf = (produced: unknown): string => {
  try {
    parseAuthSession(produced);
    return "no rejection";
  } catch (rejection) {
    return rejection instanceof Error ? rejection.name : typeof rejection;
  }
};

const it = test
  .extend("roundTrippedSession", () =>
    parseAuthSession(serializeAuthSession("session-token", new Date("2030-01-02T03:04:05.000Z"))))
  .extend("tokenlessRejection", () => rejectionNameOf({ expiresAt: "2030-01-02T03:04:05.000Z" }))
  .extend("emptyTokenRejection", () =>
    rejectionNameOf({ token: "", expiresAt: "2030-01-02T03:04:05.000Z" }),
  )
  .extend("expiryLessRejection", () => rejectionNameOf({ token: "session-token" }))
  .extend("unreadableExpiryRejection", () =>
    rejectionNameOf({ token: "session-token", expiresAt: "someday" }),
  )
  .extend("nonObjectRejection", () => rejectionNameOf("session-token"));

describe("serializeAuthSession と parseAuthSession", () => {
  it("producer が作った応答は consumer の検証をそのまま往復する", ({ roundTrippedSession }) => {
    expect(roundTrippedSession).toStrictEqual({
      token: "session-token",
      expiresAt: "2030-01-02T03:04:05.000Z",
    });
  });
});

describe("parseAuthSession の拒否", () => {
  it("token が欠けていれば拒否する", ({ tokenlessRejection }) => {
    expect(tokenlessRejection).toStrictEqual("InvalidAuthSessionError");
  });

  it("token が空文字列なら拒否する", ({ emptyTokenRejection }) => {
    expect(emptyTokenRejection).toStrictEqual("InvalidAuthSessionError");
  });

  it("expiresAt が欠けていれば拒否する", ({ expiryLessRejection }) => {
    expect(expiryLessRejection).toStrictEqual("InvalidAuthSessionError");
  });

  it("expiresAt がタイムスタンプとして読めなければ拒否する", ({ unreadableExpiryRejection }) => {
    expect(unreadableExpiryRejection).toStrictEqual("InvalidAuthSessionError");
  });

  it("応答がオブジェクトでなければ拒否する", ({ nonObjectRejection }) => {
    expect(nonObjectRejection).toStrictEqual("InvalidAuthSessionError");
  });
});
