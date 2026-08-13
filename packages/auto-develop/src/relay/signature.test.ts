import { createHmac } from "node:crypto";

import { describe, expect, test } from "vite-plus/test";

import { verifyWebhookSignature } from "./signature.ts";

describe("verifyWebhookSignature", () => {
  const it = test
    .extend("verdictForSharedSecretSignature", () => {
      const writtenBody = '{"action":"closed"}';
      return verifyWebhookSignature({
        body: writtenBody,
        signatureHeader: `sha256=${createHmac("sha256", "shared-secret").update(writtenBody).digest("hex")}`,
        secret: "shared-secret",
      });
    })
    .extend("verdictForForeignSecretSignature", () => {
      const writtenBody = '{"action":"closed"}';
      return verifyWebhookSignature({
        body: writtenBody,
        signatureHeader: `sha256=${createHmac("sha256", "another-secret").update(writtenBody).digest("hex")}`,
        secret: "shared-secret",
      });
    })
    .extend("verdictForAbsentSignatureHeader", () =>
      verifyWebhookSignature({ body: "{}", signatureHeader: undefined, secret: "shared-secret" }),
    )
    .extend("verdictForShorterSignature", () =>
      verifyWebhookSignature({ body: "{}", signatureHeader: "sha256=00", secret: "shared-secret" }),
    );

  it("共有シークレットで計算した署名は通過する", ({ verdictForSharedSecretSignature }) => {
    expect(verdictForSharedSecretSignature).toStrictEqual(true);
  });

  it("別シークレットの署名は拒否される", ({ verdictForForeignSecretSignature }) => {
    expect(verdictForForeignSecretSignature).toStrictEqual(false);
  });

  it("署名ヘッダなしは拒否される", ({ verdictForAbsentSignatureHeader }) => {
    expect(verdictForAbsentSignatureHeader).toStrictEqual(false);
  });

  it("期待値と長さの違う署名は拒否される", ({ verdictForShorterSignature }) => {
    expect(verdictForShorterSignature).toStrictEqual(false);
  });
});
