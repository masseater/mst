import { describe, expect, test, vi } from "vite-plus/test";

import { IdTokenRejectionError } from "./id-token-rejection-error.ts";
import { IdTokenUnavailableError } from "./id-token-unavailable-error.ts";
import { authenticateScheduler, type IdTokenVerifier } from "./scheduler-auth.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

const allowedEmails = ["scheduler@example.test"];

const acceptingVerifier: IdTokenVerifier = () =>
  Promise.resolve({ email: "scheduler@example.test", emailVerified: true });

describe("authenticateScheduler", () => {
  test("許可リスト内の検証済み email は principal になる", async () => {
    const principal = await authenticateScheduler({
      idToken: "signed-id-token",
      audience: "https://relay.example.test",
      allowedEmails,
      verify: acceptingVerifier,
    });
    expect(principal).toStrictEqual({ email: "scheduler@example.test" });
  });

  test("許可リストが空なら検証を呼ばずに全拒否する", async () => {
    const verify = vi.fn<IdTokenVerifier>();
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails: [],
        verify,
      }),
    ).rejects.toThrow(UnauthenticatedError);
    expect(verify).not.toHaveBeenCalled();
  });

  test("クレデンシャル未提示は拒否される", async () => {
    await expect(
      authenticateScheduler({
        idToken: undefined,
        audience: "https://relay.example.test",
        allowedEmails,
        verify: acceptingVerifier,
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("audience となる公開オリジンが未設定なら拒否される", async () => {
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: undefined,
        allowedEmails,
        verify: acceptingVerifier,
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("email_verified が真でなければ拒否される", async () => {
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails,
        verify: () => Promise.resolve({ email: "scheduler@example.test", emailVerified: false }),
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("email クレームが無ければ拒否される", async () => {
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails,
        verify: () => Promise.resolve({ email: undefined, emailVerified: true }),
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("許可リスト外の email は拒否される", async () => {
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails,
        verify: () => Promise.resolve({ email: "stranger@example.test", emailVerified: true }),
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("検証器の明示拒否は確定的拒否になる", async () => {
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails,
        verify: () => Promise.reject(new IdTokenRejectionError("wrong audience")),
      }),
    ).rejects.toThrow(UnauthenticatedError);
  });

  test("証明書取得不能は検証器不能になる", async () => {
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails,
        verify: () => Promise.reject(new IdTokenUnavailableError("certificate timeout")),
      }),
    ).rejects.toThrow(VerifierUnavailableError);
  });

  test("未分類の失敗はトークンを引用しない固定文言に置き換えられる", async () => {
    await expect(
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails,
        verify: () => Promise.reject(new Error("verifier quoted token signed-id-token")),
      }),
    ).rejects.toThrow("id token verification failed for an unclassified reason");
  });
});
