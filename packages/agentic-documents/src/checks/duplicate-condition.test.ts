import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { repeatedConditions } from "./duplicate-condition.ts";

describe("repeatedConditions", () => {
  describe("入れ子の項目と条件を持たない項目が並ぶ文書", () => {
    const it = test.extend("problems", () =>
      repeatedConditions(
        toNormativeDocument({
          file: "AGENTS.md",
          source: "- - IF: 開始する; THEN MUST: 記録する\n- 条件を持たない項目\n",
          config: defaultConfig,
        }),
      ));

    it("散文で始まらない項目と条件を持たない項目は数えない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("同じ階層で同じ条件を繰り返す文書", () => {
    const it = test.extend("problems", () =>
      repeatedConditions(
        toNormativeDocument({
          file: "AGENTS.md",
          source: "- IF: 開始する; THEN MUST: 記録する\n- IF: 開始する; THEN MUST: 通知する\n",
          config: defaultConfig,
        }),
      ));

    it("繰り返された条件の行を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: "AGENTS.md",
          line: 2,
          message:
            "同じ階層で条件 `開始する` を繰り返すことは禁止されている。条件を 1 度だけ書き、行動をその下に入れ子で並べる。",
        },
      ]);
    });
  });

  describe("異なる条件が並ぶ文書", () => {
    const it = test.extend("problems", () =>
      repeatedConditions(
        toNormativeDocument({
          file: "AGENTS.md",
          source: "- IF: 開始する; THEN MUST: 記録する\n- IF: 終了する; THEN MUST: 通知する\n",
          config: defaultConfig,
        }),
      ));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("引用の中身だけが異なる条件が並ぶ文書", () => {
    const it = test.extend("problems", () =>
      repeatedConditions(
        toNormativeDocument({
          file: "AGENTS.md",
          source:
            "- IF: 状態が `開始` である; THEN MUST: 記録する\n- IF: 状態が `終了` である; THEN MUST: 通知する\n",
          config: defaultConfig,
        }),
      ));

    it("別の条件として扱い何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
