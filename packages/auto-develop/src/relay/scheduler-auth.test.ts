import { describe, expect, test, vi } from "vite-plus/test";

import { IdTokenRejectionError } from "./id-token-rejection-error.ts";
import { IdTokenUnavailableError } from "./id-token-unavailable-error.ts";
import { authenticateScheduler, type IdTokenVerifier } from "./scheduler-auth.ts";
import { UnauthenticatedError } from "./unauthenticated-error.ts";
import { VerifierUnavailableError } from "./verifier-unavailable-error.ts";

describe("authenticateScheduler", () => {
  const it = test
    .extend("principalForAllowedEmail", () =>
      authenticateScheduler({
        idToken: "signed-id-token",
        audience: "https://relay.example.test",
        allowedEmails: ["scheduler@example.test"],
        verify: () => Promise.resolve({ email: "scheduler@example.test", emailVerified: true }),
      }))
    .extend("rejectionOfEmptyAllowlist", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: [],
          verify: () => Promise.resolve({ email: "scheduler@example.test", emailVerified: true }),
        });
        throw new Error("an empty allowlist was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("verifierUnderEmptyAllowlist", async () => {
      const verifierUnderEmptyAllowlist = vi.fn<IdTokenVerifier>();
      await Promise.allSettled([
        authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: [],
          verify: verifierUnderEmptyAllowlist,
        }),
      ]);
      return verifierUnderEmptyAllowlist;
    })
    .extend("rejectionOfMissingIdToken", async () => {
      try {
        await authenticateScheduler({
          idToken: undefined,
          audience: "https://relay.example.test",
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.resolve({ email: "scheduler@example.test", emailVerified: true }),
        });
        throw new Error("a missing credential was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("rejectionOfMissingAudience", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: undefined,
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.resolve({ email: "scheduler@example.test", emailVerified: true }),
        });
        throw new Error("a missing public origin was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("rejectionOfUnverifiedEmailClaim", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.resolve({ email: "scheduler@example.test", emailVerified: false }),
        });
        throw new Error("an unverified email claim was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("rejectionOfMissingEmailClaim", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.resolve({ email: undefined, emailVerified: true }),
        });
        throw new Error("a missing email claim was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("rejectionOfEmailOutsideAllowlist", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.resolve({ email: "stranger@example.test", emailVerified: true }),
        });
        throw new Error("an email outside the allowlist was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("rejectionOfExplicitVerifierRefusal", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.reject(new IdTokenRejectionError("wrong audience")),
        });
        throw new Error("an explicitly refused id token was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("rejectionOfUnreachableCertificate", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.reject(new IdTokenUnavailableError("certificate timeout")),
        });
        throw new Error("an unverifiable id token was accepted");
      } catch (rejection) {
        return rejection;
      }
    })
    .extend("rejectionOfUnclassifiedVerifierFailure", async () => {
      try {
        await authenticateScheduler({
          idToken: "signed-id-token",
          audience: "https://relay.example.test",
          allowedEmails: ["scheduler@example.test"],
          verify: () => Promise.reject(new Error("verifier quoted token signed-id-token")),
        });
        throw new Error("an unclassified verifier failure was accepted");
      } catch (rejection) {
        return rejection;
      }
    });

  it("許可リスト内の検証済み email は principal になる", ({ principalForAllowedEmail }) => {
    expect(principalForAllowedEmail).toStrictEqual({ email: "scheduler@example.test" });
  });

  it("許可リストが空なら全拒否する", ({ rejectionOfEmptyAllowlist }) => {
    expect(rejectionOfEmptyAllowlist).toStrictEqual(
      new UnauthenticatedError("no scheduler service account is allowed by configuration"),
    );
  });

  it("許可リストが空なら検証を呼ばない", ({ verifierUnderEmptyAllowlist }) => {
    expect(verifierUnderEmptyAllowlist).not.toHaveBeenCalled();
  });

  it("クレデンシャル未提示は拒否される", ({ rejectionOfMissingIdToken }) => {
    expect(rejectionOfMissingIdToken).toStrictEqual(
      new UnauthenticatedError("scheduler credential missing"),
    );
  });

  it("audience となる公開オリジンが未設定なら拒否される", ({ rejectionOfMissingAudience }) => {
    expect(rejectionOfMissingAudience).toStrictEqual(
      new UnauthenticatedError("public origin for audience verification is not configured"),
    );
  });

  it("email_verified が真でなければ拒否される", ({ rejectionOfUnverifiedEmailClaim }) => {
    expect(rejectionOfUnverifiedEmailClaim).toStrictEqual(
      new UnauthenticatedError("email claim is not verified"),
    );
  });

  it("email クレームが無ければ拒否される", ({ rejectionOfMissingEmailClaim }) => {
    expect(rejectionOfMissingEmailClaim).toStrictEqual(
      new UnauthenticatedError("email claim missing"),
    );
  });

  it("許可リスト外の email は拒否される", ({ rejectionOfEmailOutsideAllowlist }) => {
    expect(rejectionOfEmailOutsideAllowlist).toStrictEqual(
      new UnauthenticatedError("service account is not in the allowlist"),
    );
  });

  it("検証器の明示拒否は確定的拒否になる", ({ rejectionOfExplicitVerifierRefusal }) => {
    expect(rejectionOfExplicitVerifierRefusal).toStrictEqual(
      new UnauthenticatedError("id token was rejected"),
    );
  });

  it("証明書取得不能は検証器不能になる", ({ rejectionOfUnreachableCertificate }) => {
    expect(rejectionOfUnreachableCertificate).toStrictEqual(
      new VerifierUnavailableError("id token could not be verified"),
    );
  });

  it("未分類の失敗はトークンを引用しない固定文言に置き換えられる", ({
    rejectionOfUnclassifiedVerifierFailure,
  }) => {
    expect(rejectionOfUnclassifiedVerifierFailure).toStrictEqual(
      new Error("id token verification failed for an unclassified reason"),
    );
  });
});
