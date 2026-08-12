import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { CACHE_FORMAT_VERSION } from "./catalog-cache-validation.ts";

import type { ScannedFile } from "./source-files.ts";

const updateLengthPrefixed = (hash: ReturnType<typeof createHash>, identity: string): void => {
  hash.update(`${Buffer.byteLength(identity)}:`);
  hash.update(identity);
};

const updateFileFingerprint = (hash: ReturnType<typeof createHash>, file: ScannedFile): void => {
  const fileBytes = readFileSync(file.absolutePath);
  [file.relativePath, file.realPathIdentity, file.symbolicLinkTarget ?? ""].forEach((identity) => {
    updateLengthPrefixed(hash, identity);
  });
  hash.update(`${fileBytes.byteLength}:`);
  hash.update(fileBytes);
};

const updateProblemFingerprint = (
  hash: ReturnType<typeof createHash>,
  problem: { readonly filePath: string; readonly kind: string; readonly line: number },
): void => {
  updateLengthPrefixed(hash, JSON.stringify(problem));
};

export const cacheInputFingerprint = (
  files: readonly ScannedFile[],
  problems: readonly {
    readonly filePath: string;
    readonly kind: string;
    readonly line: number;
  }[] = [],
): string => {
  const hash = createHash("sha256");
  hash.update(String(CACHE_FORMAT_VERSION));
  files.forEach((file) => {
    updateFileFingerprint(hash, file);
  });
  problems.forEach((problem) => {
    updateProblemFingerprint(hash, problem);
  });
  return hash.digest("hex");
};
