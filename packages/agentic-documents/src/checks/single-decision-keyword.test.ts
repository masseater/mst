import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { multipleDecisionKeywords } from "./single-decision-keyword.ts";

const TWO_KEYWORD_MESSAGE =
  "1 つの項目に判断キーワードを 2 個置くことは禁止されている。条件を親の項目へ上げ、判断ごとに入れ子の項目を作る。";

describe("multipleDecisionKeywords", () => {
  describe("散文で始まらず、判断キーワードを 2 つ持つ入れ子の項目だけを持つ項目", () => {
    const it = test.extend("problems", () =>
      multipleDecisionKeywords({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- - MUST: 記録する PROHIBIT: 省略する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("判断を持つのは入れ子の項目だけなので、その項目だけを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: TWO_KEYWORD_MESSAGE },
      ]);
    });
  });

  describe("1 つの項目に判断キーワードを 2 つ置いた項目", () => {
    const it = test.extend("problems", () =>
      multipleDecisionKeywords({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- MUST: 記録する PROHIBIT: 省略する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("その項目を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 1, message: TWO_KEYWORD_MESSAGE },
      ]);
    });
  });

  describe("判断キーワードが 1 つだけの項目", () => {
    const it = test.extend("problems", () =>
      multipleDecisionKeywords({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- MUST: 記録する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("判断キーワードを入れ子の項目へ分けた項目", () => {
    const it = test.extend("problems", () =>
      multipleDecisionKeywords({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- IF: 開始する; THEN\n  - MUST: 記録する\n  - PROHIBIT: 省略する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("入れ子の判断を親の数に含めず、何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("引用で囲んだ綴りを本文に持つ項目", () => {
    const it = test.extend("problems", () =>
      multipleDecisionKeywords({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- MUST: `PROHIBIT:` の綴りを説明する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("引用の綴りを判断として数えず、何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
