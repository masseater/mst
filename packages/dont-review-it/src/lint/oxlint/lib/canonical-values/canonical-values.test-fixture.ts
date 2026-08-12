import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { onTestFinished } from "vite-plus/test";

export const createCanonicalValuesTestRepository = (): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
  onTestFinished(() => {
    rmSync(repositoryRoot, { recursive: true, force: true });
  });
  return repositoryRoot;
};

export const writeCanonicalValuesTestFile = ({
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

export const writeCanonicalValuesTestFiles = ({
  repositoryRoot,
  files,
}: {
  readonly repositoryRoot: string;
  readonly files: Readonly<Record<string, string>>;
}): void => {
  for (const [relativePath, fileText] of Object.entries(files)) {
    writeCanonicalValuesTestFile({ contents: fileText, relativePath, repositoryRoot });
  }
};

export const annotateCanonicalValues = (conceptId: string, declaration: string): string =>
  `/** @canonical-values ${conceptId} */\n${declaration}\n`;
