import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { repeatedConditions } from "./duplicate-condition.ts";

const conditionProblemsIn = (source: string) =>
  repeatedConditions(toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }));

describe("repeatedConditions", () => {
  test("散文で始まらない項目と条件を持たない項目は数えない", () => {
    expect(
      conditionProblemsIn("- - IF: 開始する; THEN MUST: 記録する\n- 条件を持たない項目\n"),
    ).toStrictEqual([]);
  });

  test("同じ階層で条件が繰り返されると報告する", () => {
    const source = "- IF: 開始する; THEN MUST: 記録する\n- IF: 開始する; THEN MUST: 通知する\n";

    expect(conditionProblemsIn(source).length).toStrictEqual(1);
  });

  test("条件が異なれば報告しない", () => {
    const source = "- IF: 開始する; THEN MUST: 記録する\n- IF: 終了する; THEN MUST: 通知する\n";

    expect(conditionProblemsIn(source)).toStrictEqual([]);
  });

  test("引用の中身が違えば別の条件として扱う", () => {
    const source =
      "- IF: 状態が `開始` である; THEN MUST: 記録する\n- IF: 状態が `終了` である; THEN MUST: 通知する\n";

    expect(conditionProblemsIn(source)).toStrictEqual([]);
  });
});
