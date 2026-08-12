import { createHmac, timingSafeEqual } from "node:crypto";

export const verifyWebhookSignature = (asked: {
  readonly body: string;
  readonly signatureHeader: string | undefined;
  readonly secret: string;
}): boolean => {
  if (asked.signatureHeader === undefined) return false;
  const expectedHex = createHmac("sha256", asked.secret).update(asked.body).digest("hex");
  const expectedHeader = Buffer.from(`sha256=${expectedHex}`);
  const providedHeader = Buffer.from(asked.signatureHeader);
  return (
    providedHeader.length === expectedHeader.length &&
    timingSafeEqual(providedHeader, expectedHeader)
  );
};
