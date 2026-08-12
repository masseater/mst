import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { tablesInNormativeDocument } from "./no-table.ts";

const TABLE_MESSAGE =
  "規範を表の行として書くことは禁止されている。各行を `IF: <条件>; THEN <キーワード>: <行動>` の項目に書き直す。規範ではない一覧であれば、規範文書の外へ移す。";

const it = test
  .extend("problemsForADocumentHoldingATable", () =>
    tablesInNormativeDocument(
      toNormativeDocument({
        file: "AGENTS.md",
        source: "| 条件 | 行動 |\n| --- | --- |\n| 開始する | 記録する |\n",
        config: defaultConfig,
      }),
    ))
  .extend("problemsForADocumentHoldingNoTable", () =>
    tablesInNormativeDocument(
      toNormativeDocument({
        file: "AGENTS.md",
        source: "# 規約\n\n- MUST: 開始する前に記録する\n",
        config: defaultConfig,
      }),
    ),
  )
  .extend("problemsForATableInsideTheGeneratedRegion", () =>
    tablesInNormativeDocument(
      toNormativeDocument({
        file: "AGENTS.md",
        source: `${defaultConfig.generatedRegionBoundaries[0]?.begin ?? ""}

| 条件 | 行動 |
| --- | --- |
| 開始する | 記録する |

${defaultConfig.generatedRegionBoundaries[0]?.end ?? ""}
`,
        config: defaultConfig,
      }),
    ),
  );

describe("tablesInNormativeDocument", () => {
  it("規範文書に置かれた表を報告する", ({ problemsForADocumentHoldingATable }) => {
    expect(problemsForADocumentHoldingATable).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: TABLE_MESSAGE },
    ]);
  });

  it("表を持たない文書では報告しない", ({ problemsForADocumentHoldingNoTable }) => {
    expect(problemsForADocumentHoldingNoTable).toStrictEqual([]);
  });

  it("機械が書き込む領域の中の表は報告しない", ({ problemsForATableInsideTheGeneratedRegion }) => {
    expect(problemsForATableInsideTheGeneratedRegion).toStrictEqual([]);
  });
});
