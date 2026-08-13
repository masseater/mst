import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { cacheInputFingerprint } from "./catalog-cache-fingerprint.ts";
import { listRepositoryFiles } from "./source-files.ts";

const createCanonicalValuesTestRepository = (): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
  onTestFinished(() => {
    rmSync(repositoryRoot, { recursive: true, force: true });
  });
  return repositoryRoot;
};

const writeCanonicalValuesTestFile = ({
  repositoryRoot,
  relativePath,
  contents: fileText,
}: {
  readonly repositoryRoot: string;
  readonly relativePath: string;
  readonly contents: string;
}): void => {
  const absolutePath = join(repositoryRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, fileText, "utf8");
};

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
    const fileText = 'export const value = "draft";\n';
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/first.ts",
      contents: fileText,
    });
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/second.ts",
      contents: fileText,
    });
    symlinkSync(firstTarget, link);
    const first = cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs);
    rmSync(link);
    symlinkSync(secondTarget, link);

    expect(cacheInputFingerprint(listRepositoryFiles(repositoryRoot).cacheInputs)).not.toBe(first);
  });
});
