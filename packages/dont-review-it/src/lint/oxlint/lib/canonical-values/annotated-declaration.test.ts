import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { registeredDeclarationRanges } from "./annotated-declaration.ts";
import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values.test-fixture.ts";

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
