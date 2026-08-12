import { describe, expect, test } from "vite-plus/test";

import { authFailureStatus } from "./auth-status.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

const it = test
  .extend("statusForDeterministicRejection", () =>
    authFailureStatus(new UnauthenticatedError("credential missing")))
  .extend("statusForVerifierOutage", () =>
    authFailureStatus(new VerifierUnavailableError("store unavailable")),
  )
  .extend("rethrownUnrelatedFailure", (): Error | undefined => {
    try {
      authFailureStatus(new Error("session document corrupted"));
      return undefined;
    } catch (thrown) {
      return thrown instanceof Error ? thrown : undefined;
    }
  })
  .extend("deterministicRejection", () => new UnauthenticatedError("credential missing"))
  .extend("verifierOutage", () => new VerifierUnavailableError("store unavailable"));

describe("authFailureStatus", () => {
  it("確定的拒否は 401 に写像される", ({ statusForDeterministicRejection }) => {
    expect(statusForDeterministicRejection).toStrictEqual(401);
  });

  it("検証器不能は 503 に写像される", ({ statusForVerifierOutage }) => {
    expect(statusForVerifierOutage).toStrictEqual(503);
  });

  it("認証エラー型以外は変換せず再スローする", ({ rethrownUnrelatedFailure }) => {
    expect(rethrownUnrelatedFailure?.message).toStrictEqual("session document corrupted");
  });
});

describe("認証エラー型の安定コード", () => {
  it("確定的拒否は安定コードを持つ", ({ deterministicRejection }) => {
    expect(deterministicRejection.code).toStrictEqual("RELAY_UNAUTHENTICATED");
  });

  it("確定的拒否はカテゴリを持つ", ({ deterministicRejection }) => {
    expect(deterministicRejection.category).toStrictEqual("unauthenticated");
  });

  it("検証器不能は安定コードを持つ", ({ verifierOutage }) => {
    expect(verifierOutage.code).toStrictEqual("RELAY_AUTH_VERIFIER_UNAVAILABLE");
  });

  it("検証器不能はカテゴリを持つ", ({ verifierOutage }) => {
    expect(verifierOutage.category).toStrictEqual("verifier-unavailable");
  });
});
