import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { negatedKeywordSpellings } from "./prohibition-spelling.ts";

const NEGATED_SPELLING_MESSAGE =
  "判断キーワードとして `MUST NOT:` を使うことは禁止されている。`PROHIBIT:` に置き換える。行頭の 1 語で禁止だと判別できる綴りに固定するため。";

describe("negatedKeywordSpellings", () => {
  describe("否定形の綴りを判断として使った規範文書", () => {
    const it = test.extend("problems", () =>
      negatedKeywordSpellings({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- MUST NOT: 省略する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("その綴りが現れた行を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: NEGATED_SPELLING_MESSAGE },
      ]);
    });
  });

  describe("正の綴りを判断として使った規範文書", () => {
    const it = test.extend("problems", () =>
      negatedKeywordSpellings({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- PROHIBIT: 省略する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("否定形の綴りを区切り無しで語として置いた規範文書", () => {
    const it = test.extend("problems", () =>
      negatedKeywordSpellings({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "この文書では MUST NOT という語を説明する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("判断ではないので何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
