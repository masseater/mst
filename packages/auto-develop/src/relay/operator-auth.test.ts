import { describe, expect, test } from "vite-plus/test";

import { credentialDigest } from "./digest.ts";
import { createMemorySessionStore } from "./memory-store.ts";
import { authenticateOperator } from "./operator-auth.ts";
import { TransientStoreError, type SessionStore } from "./store.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

describe("authenticateOperator", () => {
  test("有効なクレデンシャルから login が解決される", async () => {
    const sessions = createMemorySessionStore();
    await sessions.save({
      digest: credentialDigest("connection-credential"),
      login: "octocat",
      expiresAtMs: 2_000_000,
    });
    const principal = await authenticateOperator({
      credential: "connection-credential",
      sessions,
      now: () => 1_999_999,
    });
    expect(principal).toStrictEqual({ login: "octocat" });
  });

  test("クレデンシャル未提示はストアを引かずに拒否される", async () => {
    const sessions: SessionStore = {
      save: () => Promise.resolve(),
      resolve: () => Promise.reject(new Error("must not be called")),
    };
    await expect(authenticateOperator({ credential: undefined, sessions })).rejects.toThrow(
      UnauthenticatedError,
    );
  });

  test("未知のクレデンシャルは拒否される", async () => {
    await expect(
      authenticateOperator({
        credential: "unknown-credential",
        sessions: createMemorySessionStore(),
      }),
    ).rejects.toThrow("connection credential is not recognized");
  });

  test("期限ちょうどのクレデンシャルは失効していて未知と同じ文言で拒否される", async () => {
    const sessions = createMemorySessionStore();
    await sessions.save({
      digest: credentialDigest("connection-credential"),
      login: "octocat",
      expiresAtMs: 2_000_000,
    });
    await expect(
      authenticateOperator({
        credential: "connection-credential",
        sessions,
        now: () => 2_000_000,
      }),
    ).rejects.toThrow("connection credential is not recognized");
  });

  test("ストアの一時故障は検証器不能になる", async () => {
    const sessions: SessionStore = {
      save: () => Promise.resolve(),
      resolve: () => Promise.reject(new TransientStoreError("deadline exceeded")),
    };
    await expect(
      authenticateOperator({ credential: "connection-credential", sessions }),
    ).rejects.toThrow(VerifierUnavailableError);
  });

  test("未分類のストア失敗は変換されず伝播する", async () => {
    const sessions: SessionStore = {
      save: () => Promise.resolve(),
      resolve: () => Promise.reject(new Error("session document corrupted")),
    };
    await expect(
      authenticateOperator({ credential: "connection-credential", sessions }),
    ).rejects.toThrow("session document corrupted");
  });
});
