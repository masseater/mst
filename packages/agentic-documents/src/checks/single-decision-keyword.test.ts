import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { multipleDecisionKeywords } from "./single-decision-keyword.ts";

const problemsIn = (source: string) =>
  multipleDecisionKeywords({
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("multipleDecisionKeywords", () => {
  test("散文で始まらない項目そのものは判断を持たず、入れ子の項目だけが報告される", () => {
    expect(problemsIn("- - MUST: 記録する PROHIBIT: 省略する\n").length).toStrictEqual(1);
  });

  test("1 つの項目に判断キーワードが 2 つあると報告する", () => {
    expect(problemsIn("- MUST: 記録する PROHIBIT: 省略する\n").length).toStrictEqual(1);
  });

  test("判断キーワードが 1 つなら報告しない", () => {
    expect(problemsIn("- MUST: 記録する\n")).toStrictEqual([]);
  });

  test("入れ子に置かれた判断キーワードは親の数に含めない", () => {
    expect(
      problemsIn("- IF: 開始する; THEN\n  - MUST: 記録する\n  - PROHIBIT: 省略する\n"),
    ).toStrictEqual([]);
  });

  test("引用で囲まれた綴りは判断として数えない", () => {
    expect(problemsIn("- MUST: `PROHIBIT:` の綴りを説明する\n")).toStrictEqual([]);
  });
});
