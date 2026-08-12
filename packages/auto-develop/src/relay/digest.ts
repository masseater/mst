import { createHash } from "node:crypto";

export const credentialDigest = (credential: string): string =>
  createHash("sha256").update(credential).digest("hex");
