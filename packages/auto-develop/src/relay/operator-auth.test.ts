import { describe, expect, test } from "vite-plus/test";

import { credentialDigest } from "./digest.ts";
import { createMemorySessionStore } from "./memory-session-store.ts";
import { authenticateOperator } from "./operator-auth.ts";
import { TransientStoreError, type SessionStore } from "./store.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

describe("authenticateOperator", () => {
  describe("失効前のクレデンシャル", () => {
    const it = test.extend("principalForLiveCredential", async () => {
      const sessions = createMemorySessionStore();
      await sessions.save({
        digest: credentialDigest("connection-credential"),
        login: "octocat",
        expiresAtMs: 2_000_000,
      });
      return authenticateOperator({
        credential: "connection-credential",
        sessions,
        now: () => 1_999_999,
      });
    });

    it("有効なクレデンシャルから login が解決される", ({ principalForLiveCredential }) => {
      expect(principalForLiveCredential).toStrictEqual({ login: "octocat" });
    });
  });

  describe("クレデンシャル未提示", () => {
    const it = test.extend("outcomeForMissingCredential", async (): Promise<unknown> => {
      const sessions: SessionStore = {
        save: () => Promise.resolve(),
        resolve: () => Promise.reject(new Error("must not be called")),
      };
      try {
        return await authenticateOperator({ credential: undefined, sessions });
      } catch (authenticationFailure) {
        return authenticationFailure;
      }
    });

    it("クレデンシャル未提示はストアを引かずに拒否される", ({ outcomeForMissingCredential }) => {
      expect(outcomeForMissingCredential).toStrictEqual(
        new UnauthenticatedError("connection credential missing"),
      );
    });
  });

  describe("ストアに無いクレデンシャル", () => {
    const it = test.extend("outcomeForUnknownCredential", async (): Promise<unknown> => {
      try {
        return await authenticateOperator({
          credential: "unknown-credential",
          sessions: createMemorySessionStore(),
        });
      } catch (authenticationFailure) {
        return authenticationFailure;
      }
    });

    it("未知のクレデンシャルは拒否される", ({ outcomeForUnknownCredential }) => {
      expect(outcomeForUnknownCredential).toStrictEqual(
        new UnauthenticatedError("connection credential is not recognized"),
      );
    });
  });

  describe("期限ちょうどのクレデンシャル", () => {
    const it = test.extend("outcomeForJustExpiredCredential", async (): Promise<unknown> => {
      const sessions = createMemorySessionStore();
      await sessions.save({
        digest: credentialDigest("connection-credential"),
        login: "octocat",
        expiresAtMs: 2_000_000,
      });
      try {
        return await authenticateOperator({
          credential: "connection-credential",
          sessions,
          now: () => 2_000_000,
        });
      } catch (authenticationFailure) {
        return authenticationFailure;
      }
    });

    it("期限ちょうどのクレデンシャルは失効していて未知と同じ文言で拒否される", ({
      outcomeForJustExpiredCredential,
    }) => {
      expect(outcomeForJustExpiredCredential).toStrictEqual(
        new UnauthenticatedError("connection credential is not recognized"),
      );
    });
  });

  describe("一時故障するストア", () => {
    const it = test.extend("outcomeForTransientlyFailingStore", async (): Promise<unknown> => {
      const sessions: SessionStore = {
        save: () => Promise.resolve(),
        resolve: () => Promise.reject(new TransientStoreError("deadline exceeded")),
      };
      try {
        return await authenticateOperator({ credential: "connection-credential", sessions });
      } catch (authenticationFailure) {
        return authenticationFailure;
      }
    });

    it("ストアの一時故障は検証器不能になる", ({ outcomeForTransientlyFailingStore }) => {
      expect(outcomeForTransientlyFailingStore).toStrictEqual(
        new VerifierUnavailableError("session store could not be read"),
      );
    });
  });

  describe("未分類の失敗を返すストア", () => {
    const it = test.extend("outcomeForUnclassifiedStoreFailure", async (): Promise<unknown> => {
      const sessions: SessionStore = {
        save: () => Promise.resolve(),
        resolve: () => Promise.reject(new Error("session document corrupted")),
      };
      try {
        return await authenticateOperator({ credential: "connection-credential", sessions });
      } catch (authenticationFailure) {
        return authenticationFailure;
      }
    });

    it("未分類のストア失敗は変換されず伝播する", ({ outcomeForUnclassifiedStoreFailure }) => {
      expect(outcomeForUnclassifiedStoreFailure).toStrictEqual(
        new Error("session document corrupted"),
      );
    });
  });
});
