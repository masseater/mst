import { describe, expect, test } from "vite-plus/test";

import { authFailureStatus } from "./auth-status.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

describe("authFailureStatus", () => {
  test("確定的拒否は 401 に写像される", () => {
    expect(authFailureStatus(new UnauthenticatedError("credential missing"))).toStrictEqual(401);
  });

  test("検証器不能は 503 に写像される", () => {
    expect(authFailureStatus(new VerifierUnavailableError("store unavailable"))).toStrictEqual(503);
  });

  test("認証エラー型以外は変換せず再スローする", () => {
    expect(() => authFailureStatus(new Error("session document corrupted"))).toThrow(
      "session document corrupted",
    );
  });
});

describe("認証エラー型の安定コード", () => {
  test("確定的拒否はコードとカテゴリを持つ", () => {
    const rejection = new UnauthenticatedError("credential missing");
    expect([rejection.code, rejection.category]).toStrictEqual([
      "RELAY_UNAUTHENTICATED",
      "unauthenticated",
    ]);
  });

  test("検証器不能はコードとカテゴリを持つ", () => {
    const outage = new VerifierUnavailableError("store unavailable");
    expect([outage.code, outage.category]).toStrictEqual([
      "RELAY_AUTH_VERIFIER_UNAVAILABLE",
      "verifier-unavailable",
    ]);
  });
});
