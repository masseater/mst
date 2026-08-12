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
  contents,
}: {
  readonly repositoryRoot: string;
  readonly relativePath: string;
  readonly contents: string;
}): void => {
  const absolutePath = join(repositoryRoot, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
};

export const writeCanonicalValuesTestFiles = ({
  repositoryRoot,
  files,
}: {
  readonly repositoryRoot: string;
  readonly files: Readonly<Record<string, string>>;
}): void => {
  for (const [relativePath, contents] of Object.entries(files)) {
    writeCanonicalValuesTestFile({ contents, relativePath, repositoryRoot });
  }
};

export const annotateCanonicalValues = (conceptId: string, declaration: string): string =>
  `/** @canonical-values ${conceptId} */\n${declaration}\n`;
