import { createHmac } from "node:crypto";

import { describe, expect, test } from "vite-plus/test";

import { verifyWebhookSignature } from "./signature.ts";

const signedHeader = (body: string, secret: string): string =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("verifyWebhookSignature", () => {
  test("共有シークレットで計算した署名は通過する", () => {
    const body = '{"action":"closed"}';
    expect(
      verifyWebhookSignature({
        body,
        signatureHeader: signedHeader(body, "shared-secret"),
        secret: "shared-secret",
      }),
    ).toStrictEqual(true);
  });

  test("別シークレットの署名は拒否される", () => {
    const body = '{"action":"closed"}';
    expect(
      verifyWebhookSignature({
        body,
        signatureHeader: signedHeader(body, "another-secret"),
        secret: "shared-secret",
      }),
    ).toStrictEqual(false);
  });

  test("署名ヘッダなしは拒否される", () => {
    expect(
      verifyWebhookSignature({ body: "{}", signatureHeader: undefined, secret: "shared-secret" }),
    ).toStrictEqual(false);
  });

  test("期待値と長さの違う署名は拒否される", () => {
    expect(
      verifyWebhookSignature({ body: "{}", signatureHeader: "sha256=00", secret: "shared-secret" }),
    ).toStrictEqual(false);
  });
});
