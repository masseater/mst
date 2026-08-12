import { rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values.test-fixture.ts";
import { cacheInputFingerprint } from "./catalog-cache-fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

describe("catalog cache fingerprint", () => {
  test("cache input problems participate in the fingerprint", () => {
    expect(
      cacheInputFingerprint(
        [],
        [{ filePath: "src/link.ts", kind: "unsafe-symbolic-link", line: 1 }],
      ),
    ).not.toBe(cacheInputFingerprint([]));
  });

  test("a retargeted source symlink invalidates identical cache contents", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const firstTarget = join(repositoryRoot, "src/first.ts");
    const secondTarget = join(repositoryRoot, "src/second.ts");
    const link = join(repositoryRoot, "src/public.ts");
    const contents = 'export const value = "draft";\n';
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/first.ts",
      contents,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/second.ts",
      contents,
    });
    symlinkSync(firstTarget, link);
    const first = cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs);
    rmSync(link);
    symlinkSync(secondTarget, link);

    expect(cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs)).not.toBe(first);
  });
});
