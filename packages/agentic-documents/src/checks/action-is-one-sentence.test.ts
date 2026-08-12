import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { rationaleOnActionLine } from "./action-is-one-sentence.ts";

const RATIONALE_MESSAGE =
  "行動の行に理由を続けることは禁止されている。行動は 1 文で言い切り、理由はその項目の入れ子へ移す。理由を消すのではなく置き場所を変える。";

const it = test
  .extend("problemsForANestedItemCarryingARationale", () =>
    rationaleOnActionLine({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- - MUST: 記録する。記録が無いと辿れない。\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }))
  .extend("problemsForAnActionLineCarryingASecondSentence", () =>
    rationaleOnActionLine({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- MUST: 記録する。記録が無いと後から辿れないためである。\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("problemsForAnActionLineOfOneSentence", () =>
    rationaleOnActionLine({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- MUST: 記録する。\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("problemsForAConditionalItemOfOneSentence", () =>
    rationaleOnActionLine({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- IF: 開始する; THEN MUST: 記録する\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  )
  .extend("problemsForAnItemWithoutADecisionKeyword", () =>
    rationaleOnActionLine({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "- 記録する。理由はここに書く。\n",
        config: defaultConfig,
      }),
      config: defaultConfig,
    }),
  );

describe("rationaleOnActionLine", () => {
  it("散文で始まらない項目そのものは行動を持たず、入れ子の項目だけが報告される", ({
    problemsForANestedItemCarryingARationale,
  }) => {
    expect(problemsForANestedItemCarryingARationale).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: RATIONALE_MESSAGE },
    ]);
  });

  it("行動の行に 2 文目があると報告する", ({ problemsForAnActionLineCarryingASecondSentence }) => {
    expect(problemsForAnActionLineCarryingASecondSentence).toStrictEqual([
      { file: "AGENTS.md", line: 1, message: RATIONALE_MESSAGE },
    ]);
  });

  it("行動が 1 文なら報告しない", ({ problemsForAnActionLineOfOneSentence }) => {
    expect(problemsForAnActionLineOfOneSentence).toStrictEqual([]);
  });

  it("条件を持つ項目でも行動が 1 文なら報告しない", ({
    problemsForAConditionalItemOfOneSentence,
  }) => {
    expect(problemsForAConditionalItemOfOneSentence).toStrictEqual([]);
  });

  it("判断キーワードを持たない項目は対象にしない", ({
    problemsForAnItemWithoutADecisionKeyword,
  }) => {
    expect(problemsForAnItemWithoutADecisionKeyword).toStrictEqual([]);
  });
});
