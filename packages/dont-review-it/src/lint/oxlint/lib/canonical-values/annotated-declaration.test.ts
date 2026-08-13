import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { registeredDeclarationRanges } from "./annotated-declaration.ts";
import { analyzeCanonicalValuesRepository } from "./builder.ts";

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

const annotateCanonicalValues = (conceptId: string, declaration: string): string =>
  `/** @canonical-values ${conceptId} */\n${declaration}\n`;

describe("annotated declaration", () => {
  test("only the current declaration identity receives an exemption range", () => {
    const repositoryRoot = createCanonicalValuesTestRepository();
    const sourceText = annotateCanonicalValues(
      "order.status",
      'export const ORDER_STATUSES = ["draft", "published"] as const;',
    );
    writeCanonicalValuesTestFile({
      repositoryRoot,
      relativePath: "src/status.ts",
      contents: sourceText,
    });
    const catalog = analyzeCanonicalValuesRepository({ repositoryRoot }).catalog;
    const filename = join(repositoryRoot, "src/status.ts");

    expect(
      registeredDeclarationRanges({ catalog, filename, repositoryRoot, sourceText }),
    ).toHaveLength(1);
    expect(
      registeredDeclarationRanges({
        catalog,
        filename,
        repositoryRoot,
        sourceText: `\n${sourceText}`,
      }),
    ).toStrictEqual([]);
  });
});
