import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { repeatedConditions } from "./duplicate-condition.ts";

const it = test
  .extend("problemsForANestedItemAndAnItemWithoutACondition", () =>
    repeatedConditions(
      toNormativeDocument({
        file: "AGENTS.md",
        source: "- - IF: 開始する; THEN MUST: 記録する\n- 条件を持たない項目\n",
        config: defaultConfig,
      }),
    ))
  .extend("problemsForARepeatedConditionOnOneLevel", () =>
    repeatedConditions(
      toNormativeDocument({
        file: "AGENTS.md",
        source: "- IF: 開始する; THEN MUST: 記録する\n- IF: 開始する; THEN MUST: 通知する\n",
        config: defaultConfig,
      }),
    ),
  )
  .extend("problemsForTwoDifferentConditions", () =>
    repeatedConditions(
      toNormativeDocument({
        file: "AGENTS.md",
        source: "- IF: 開始する; THEN MUST: 記録する\n- IF: 終了する; THEN MUST: 通知する\n",
        config: defaultConfig,
      }),
    ),
  )
  .extend("problemsForConditionsDifferingOnlyInsideAQuotation", () =>
    repeatedConditions(
      toNormativeDocument({
        file: "AGENTS.md",
        source:
          "- IF: 状態が `開始` である; THEN MUST: 記録する\n- IF: 状態が `終了` である; THEN MUST: 通知する\n",
        config: defaultConfig,
      }),
    ),
  );

describe("repeatedConditions", () => {
  it("散文で始まらない項目と条件を持たない項目は数えない", ({
    problemsForANestedItemAndAnItemWithoutACondition,
  }) => {
    expect(problemsForANestedItemAndAnItemWithoutACondition).toStrictEqual([]);
  });

  it("同じ階層で条件が繰り返されると報告する", ({ problemsForARepeatedConditionOnOneLevel }) => {
    expect(problemsForARepeatedConditionOnOneLevel).toStrictEqual([
      {
        file: "AGENTS.md",
        line: 2,
        message:
          "同じ階層で条件 `開始する` を繰り返すことは禁止されている。条件を 1 度だけ書き、行動をその下に入れ子で並べる。",
      },
    ]);
  });

  it("条件が異なれば報告しない", ({ problemsForTwoDifferentConditions }) => {
    expect(problemsForTwoDifferentConditions).toStrictEqual([]);
  });

  it("引用の中身が違えば別の条件として扱う", ({
    problemsForConditionsDifferingOnlyInsideAQuotation,
  }) => {
    expect(problemsForConditionsDifferingOnlyInsideAQuotation).toStrictEqual([]);
  });
});
