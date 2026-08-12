import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { negatedKeywordSpellings } from "./prohibition-spelling.ts";

const NEGATED_SPELLING_MESSAGE =
  "判断キーワードとして `MUST NOT:` を使うことは禁止されている。`PROHIBIT:` に置き換える。行頭の 1 語で禁止だと判別できる綴りに固定するため。";

const it = test
  .extend("spellingProblemsOfANegatedKeyword", () =>
    negatedKeywordSpellings({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- MUST NOT: 省略する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }))
  .extend("spellingProblemsOfThePositiveKeyword", () =>
    negatedKeywordSpellings({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- PROHIBIT: 省略する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("spellingProblemsOfAKeywordWithoutASeparator", () =>
    negatedKeywordSpellings({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "この文書では MUST NOT という語を説明する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  );

describe("negatedKeywordSpellings", () => {
  it("否定形の綴りを判断として使うと報告する", ({ spellingProblemsOfANegatedKeyword }) => {
    expect(spellingProblemsOfANegatedKeyword).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: NEGATED_SPELLING_MESSAGE },
    ]);
  });

  it("正の綴りは報告しない", ({ spellingProblemsOfThePositiveKeyword }) => {
    expect(spellingProblemsOfThePositiveKeyword).toStrictEqual([]);
  });

  it("区切りを伴わない綴りは判断ではないので報告しない", ({
    spellingProblemsOfAKeywordWithoutASeparator,
  }) => {
    expect(spellingProblemsOfAKeywordWithoutASeparator).toStrictEqual([]);
  });
});
