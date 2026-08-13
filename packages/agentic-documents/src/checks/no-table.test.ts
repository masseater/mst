import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { tablesInNormativeDocument } from "./no-table.ts";

const TABLE_MESSAGE =
  "規範を表の行として書くことは禁止されている。各行を `IF: <条件>; THEN <キーワード>: <行動>` の項目に書き直す。規範ではない一覧であれば、規範文書の外へ移す。";

describe("tablesInNormativeDocument", () => {
  describe("表を置いた規範文書", () => {
    const it = test.extend("problems", () =>
      tablesInNormativeDocument(
        toNormativeDocument({
          file: "AGENTS.md",
          source: "| 条件 | 行動 |\n| --- | --- |\n| 開始する | 記録する |\n",
          config: defaultConfig,
        }),
      ));

    it("表の始まる行を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: "AGENTS.md", line: 1, message: TABLE_MESSAGE }]);
    });
  });

  describe("表を持たない規範文書", () => {
    const it = test.extend("problems", () =>
      tablesInNormativeDocument(
        toNormativeDocument({
          file: "AGENTS.md",
          source: "# 規約\n\n- MUST: 開始する前に記録する\n",
          config: defaultConfig,
        }),
      ));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("機械が書き込む領域の中に置かれた表", () => {
    const it = test.extend("problems", () =>
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
      ));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
