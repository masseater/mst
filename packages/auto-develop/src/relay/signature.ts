import { createHmac, timingSafeEqual } from "node:crypto";

export const verifyWebhookSignature = (request: {
  readonly body: string;
  readonly signatureHeader: string | undefined;
  readonly secret: string;
}): boolean => {
  if (request.signatureHeader === undefined) return false;
  const expectedHex = createHmac("sha256", request.secret).update(request.body).digest("hex");
  const expectedHeader = Buffer.from(`sha256=${expectedHex}`);
  const providedHeader = Buffer.from(request.signatureHeader);
  return (
    providedHeader.length === expectedHeader.length &&
    timingSafeEqual(providedHeader, expectedHeader)
  );
};
