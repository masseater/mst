import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { rationaleOnActionLine } from "./action-is-one-sentence.ts";

const RATIONALE_MESSAGE =
  "行動の行に理由を続けることは禁止されている。行動は 1 文で言い切り、理由はその項目の入れ子へ移す。理由を消すのではなく置き場所を変える。";

describe("rationaleOnActionLine", () => {
  describe("散文で始まらず、理由を続けた入れ子の項目だけを持つ項目", () => {
    const it = test.extend("problems", () =>
      rationaleOnActionLine({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- - MUST: 記録する。記録が無いと辿れない。\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("行動を持つのは入れ子の項目だけなので、その項目だけを報告する", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: "AGENTS.md", line: 1, message: RATIONALE_MESSAGE }]);
    });
  });

  describe("行動の行に 2 文目を続けた項目", () => {
    const it = test.extend("problems", () =>
      rationaleOnActionLine({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- MUST: 記録する。記録が無いと後から辿れないためである。\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("その行を報告する", ({ problems }) => {
      expect(problems).toStrictEqual([{ file: "AGENTS.md", line: 1, message: RATIONALE_MESSAGE }]);
    });
  });

  describe("行動が 1 文で終わる項目", () => {
    const it = test.extend("problems", () =>
      rationaleOnActionLine({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- MUST: 記録する。\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("条件を持ち、行動が 1 文で終わる項目", () => {
    const it = test.extend("problems", () =>
      rationaleOnActionLine({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- IF: 開始する; THEN MUST: 記録する\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("判断キーワードを持たない項目", () => {
    const it = test.extend("problems", () =>
      rationaleOnActionLine({
        document: toNormativeDocument({
          file: "AGENTS.md",
          source: "- 記録する。理由はここに書く。\n",
          config: defaultConfig,
        }),
        config: defaultConfig,
      }));

    it("検査の対象にならず、何も報告しない", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
