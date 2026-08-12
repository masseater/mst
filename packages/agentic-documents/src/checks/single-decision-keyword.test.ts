import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { multipleDecisionKeywords } from "./single-decision-keyword.ts";

const TWO_KEYWORD_MESSAGE =
  "1 つの項目に判断キーワードを 2 個置くことは禁止されている。条件を親の項目へ上げ、判断ごとに入れ子の項目を作る。";

const it = test
  .extend("keywordProblemsOfAnItemThatOnlyHoldsANestedItem", () =>
    multipleDecisionKeywords({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- - MUST: 記録する PROHIBIT: 省略する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }))
  .extend("keywordProblemsOfTwoKeywordsInOneItem", () =>
    multipleDecisionKeywords({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- MUST: 記録する PROHIBIT: 省略する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("keywordProblemsOfOneKeywordInOneItem", () =>
    multipleDecisionKeywords({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- MUST: 記録する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("keywordProblemsOfKeywordsSplitIntoNestedItems", () =>
    multipleDecisionKeywords({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- IF: 開始する; THEN\n  - MUST: 記録する\n  - PROHIBIT: 省略する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("keywordProblemsOfAQuotedSpelling", () =>
    multipleDecisionKeywords({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- MUST: `PROHIBIT:` の綴りを説明する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  );

describe("multipleDecisionKeywords", () => {
  it("散文で始まらない項目そのものは判断を持たず、入れ子の項目だけが報告される", ({
    keywordProblemsOfAnItemThatOnlyHoldsANestedItem,
  }) => {
    expect(keywordProblemsOfAnItemThatOnlyHoldsANestedItem).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: TWO_KEYWORD_MESSAGE },
    ]);
  });

  it("1 つの項目に判断キーワードが 2 つあると報告する", ({
    keywordProblemsOfTwoKeywordsInOneItem,
  }) => {
    expect(keywordProblemsOfTwoKeywordsInOneItem).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: TWO_KEYWORD_MESSAGE },
    ]);
  });

  it("判断キーワードが 1 つなら報告しない", ({ keywordProblemsOfOneKeywordInOneItem }) => {
    expect(keywordProblemsOfOneKeywordInOneItem).toStrictEqual([]);
  });

  it("入れ子に置かれた判断キーワードは親の数に含めない", ({
    keywordProblemsOfKeywordsSplitIntoNestedItems,
  }) => {
    expect(keywordProblemsOfKeywordsSplitIntoNestedItems).toStrictEqual([]);
  });

  it("引用で囲まれた綴りは判断として数えない", ({ keywordProblemsOfAQuotedSpelling }) => {
    expect(keywordProblemsOfAQuotedSpelling).toStrictEqual([]);
  });
});
