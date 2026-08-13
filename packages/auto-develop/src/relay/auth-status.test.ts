import { describe, expect, test } from "vite-plus/test";

import { authFailureStatus } from "./auth-status.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

describe("authFailureStatus", () => {
  describe("確定的な拒否", () => {
    const it = test.extend("statusForDeterministicRejection", () =>
      authFailureStatus(new UnauthenticatedError("credential missing")));

    it("確定的拒否は 401 に写像される", ({ statusForDeterministicRejection }) => {
      expect(statusForDeterministicRejection).toBe(401);
    });
  });

  describe("検証器の不能", () => {
    const it = test.extend("statusForVerifierOutage", () =>
      authFailureStatus(new VerifierUnavailableError("store unavailable")));

    it("検証器不能は 503 に写像される", ({ statusForVerifierOutage }) => {
      expect(statusForVerifierOutage).toBe(503);
    });
  });

  describe("認証エラー型以外の失敗", () => {
    const it = test.extend("outcomeForUnrelatedFailure", (): unknown => {
      try {
        return authFailureStatus(new Error("session document corrupted"));
      } catch (unrelatedFailure) {
        return unrelatedFailure;
      }
    });

    it("認証エラー型以外は変換せず再スローする", ({ outcomeForUnrelatedFailure }) => {
      expect(outcomeForUnrelatedFailure).toStrictEqual(new Error("session document corrupted"));
    });
  });
});
