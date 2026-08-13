import { describe, expect, test } from "vite-plus/test";

import { parseAuthSession, serializeAuthSession } from "./auth-session.ts";

describe("serializeAuthSession と parseAuthSession", () => {
  const it = test.extend("roundTrippedSession", () =>
    parseAuthSession(serializeAuthSession("session-token", new Date("2030-01-02T03:04:05.000Z"))));

  it("producer が作った応答は consumer の検証をそのまま往復する", ({ roundTrippedSession }) => {
    expect(roundTrippedSession).toStrictEqual({
      token: "session-token",
      expiresAt: "2030-01-02T03:04:05.000Z",
    });
  });
});

describe("parseAuthSession の拒否", () => {
  const it = test
    .extend("tokenlessRejection", () => {
      try {
        parseAuthSession({ expiresAt: "2030-01-02T03:04:05.000Z" });
      } catch (rejection) {
        return rejection instanceof Error ? rejection.name : typeof rejection;
      }
      throw new Error("parseAuthSession accepted a payload without a token");
    })
    .extend("emptyTokenRejection", () => {
      try {
        parseAuthSession({ token: "", expiresAt: "2030-01-02T03:04:05.000Z" });
      } catch (rejection) {
        return rejection instanceof Error ? rejection.name : typeof rejection;
      }
      throw new Error("parseAuthSession accepted a payload whose token is empty");
    })
    .extend("expiryLessRejection", () => {
      try {
        parseAuthSession({ token: "session-token" });
      } catch (rejection) {
        return rejection instanceof Error ? rejection.name : typeof rejection;
      }
      throw new Error("parseAuthSession accepted a payload without an expiresAt");
    })
    .extend("unreadableExpiryRejection", () => {
      try {
        parseAuthSession({ token: "session-token", expiresAt: "someday" });
      } catch (rejection) {
        return rejection instanceof Error ? rejection.name : typeof rejection;
      }
      throw new Error("parseAuthSession accepted a payload whose expiresAt is unreadable");
    })
    .extend("nonObjectRejection", () => {
      try {
        parseAuthSession("session-token");
      } catch (rejection) {
        return rejection instanceof Error ? rejection.name : typeof rejection;
      }
      throw new Error("parseAuthSession accepted a payload that is not an object");
    });

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
