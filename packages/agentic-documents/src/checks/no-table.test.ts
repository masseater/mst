import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { tablesInNormativeDocument } from "./no-table.ts";

const documentOf = (source: string) =>
  toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig });

describe("tablesInNormativeDocument", () => {
  test("規範文書に置かれた表を報告する", () => {
    const problems = tablesInNormativeDocument(
      documentOf("| 条件 | 行動 |\n| --- | --- |\n| 開始する | 記録する |\n"),
    );

    expect(problems.length).toStrictEqual(1);
  });

  test("表を持たない文書では報告しない", () => {
    const problems = tablesInNormativeDocument(
      documentOf("# 規約\n\n- MUST: 開始する前に記録する\n"),
    );

    expect(problems).toStrictEqual([]);
  });

  test("機械が書き込む領域の中の表は報告しない", () => {
    const source = `${defaultConfig.generatedRegionBoundaries[0]?.begin ?? ""}

| 条件 | 行動 |
| --- | --- |
| 開始する | 記録する |

${defaultConfig.generatedRegionBoundaries[0]?.end ?? ""}
`;

    expect(tablesInNormativeDocument(documentOf(source))).toStrictEqual([]);
  });
});
