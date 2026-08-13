import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { contrastiveCodePairs } from "./contrastive-code-pair.ts";

const PAIR_MESSAGE =
  "同じ節に良い例と悪い例のコードを対で置くことは禁止されている。差を機械が判別できるなら検査を作り、例はその検査の説明文書へ移す。判別できないなら例を消し、何を見て判断するのかを条件と行動として書く。";

describe("contrastiveCodePairs", () => {
  describe("節の境界より深い見出しで隔てられた対", () => {
    const it = test.extend("problems", () =>
      contrastiveCodePairs({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source:
            "## 書き方\n\n### 例\n\n```ts\n// 悪い例\nconst a = 1;\n```\n\n```ts\n<!-- 良い例 -->\nconst count = 1;\n```\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("深い見出しは節を変えないので、またいだ対の両方を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 5, message: PAIR_MESSAGE },
        { file: "AGENTS.md", line: 10, message: PAIR_MESSAGE },
      ]);
    });
  });

  describe("先頭行が注釈でないコードと、注釈が空のコード", () => {
    const it = test.extend("problems", () =>
      contrastiveCodePairs({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source:
            "## 書き方\n\n```ts\nconst a = 1;\n```\n\n```ts\n```\n\n```ts\n//\nconst b = 2;\n```\n\n```ts\n/* 手順 */\nconst c = 3;\n```\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("対の印を持たないので何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("同じ節に置かれた対の例", () => {
    const it = test.extend("problems", () =>
      contrastiveCodePairs({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source:
            "## 書き方\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n\n良い例:\n\n```ts\nconst count = 1;\n```\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("両方の例を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: "AGENTS.md", line: 5, message: PAIR_MESSAGE },
        { file: "AGENTS.md", line: 11, message: PAIR_MESSAGE },
      ]);
    });
  });

  describe("片方の印しか持たない節", () => {
    const it = test.extend("problems", () =>
      contrastiveCodePairs({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "## 書き方\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("別の節に分かれて置かれた印", () => {
    const it = test.extend("problems", () =>
      contrastiveCodePairs({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source:
            "## 避ける形\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n\n## 望ましい形\n\n良い例:\n\n```ts\nconst count = 1;\n```\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("印を持たないコード", () => {
    const it = test.extend("problems", () =>
      contrastiveCodePairs({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "## 書き方\n\n```ts\nconst count = 1;\n```\n\n```ts\nconst total = 2;\n```\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
