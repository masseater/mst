import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { brokenOrderedSequences } from "./ordered-sequence.ts";

const sequenceProblemsIn = (source: string) =>
  brokenOrderedSequences({
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("brokenOrderedSequences", () => {
  test("順序を表す語を持たない見出しは報告しない", () => {
    expect(sequenceProblemsIn("## 書き方\n\n**注意**を読む\n")).toStrictEqual([]);
  });

  test("番号の続きの行は番号として数えない", () => {
    expect(sequenceProblemsIn("1. 始める\n   続きの行\n2. 終える\n")).toStrictEqual([]);
  });

  test("強調に置かれた 0 のラベルも報告する", () => {
    expect(sequenceProblemsIn("**Phase 0** を参照する\n").length).toStrictEqual(1);
  });

  test("0 から始まる番号を報告する", () => {
    expect(sequenceProblemsIn("0. 準備する\n1. 実行する\n").length).toStrictEqual(1);
  });

  test("番号が飛んでいると報告する", () => {
    expect(sequenceProblemsIn("1. 準備する\n2. 実行する\n4. 記録する\n").length).toStrictEqual(1);
  });

  test("小数の番号が割り込むと報告する", () => {
    expect(sequenceProblemsIn("1. 準備する\n1.5. 確認する\n2. 実行する\n").length).toStrictEqual(1);
  });

  test("順序を表す語と 0 のラベルを報告する", () => {
    expect(sequenceProblemsIn("## Phase 0 の準備\n").length).toStrictEqual(1);
  });

  test("1 から始まる連続した番号は報告しない", () => {
    expect(sequenceProblemsIn("1. 準備する\n2. 実行する\n3. 記録する\n")).toStrictEqual([]);
  });
});
