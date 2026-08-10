import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { duplicatedNormativeUnits } from "./duplicate-normative-units.ts";

const REPEATED_RULE =
  "- MUST: 実装の根拠をコードコメントに書かず、経緯はコミットメッセージの本文に残す\n";

const unitProblemsIn = (sources: Readonly<Record<string, string>>) =>
  duplicatedNormativeUnits({
    documents: Object.entries(sources).map(([file, source]) =>
      toNormativeDocument({ file, source, config: defaultConfig }),
    ),
    config: defaultConfig,
  });

describe("duplicatedNormativeUnits", () => {
  test("2 つの文書に同じ規範が写されていると報告する", () => {
    const problems = unitProblemsIn({
      "AGENTS.md": REPEATED_RULE,
      "packages/example/AGENTS.md": REPEATED_RULE,
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("1 つの文書にしか現れない規範は報告しない", () => {
    const problems = unitProblemsIn({
      "AGENTS.md": REPEATED_RULE,
      "packages/example/AGENTS.md": "- MUST: 依存の版をカタログに集約する\n",
    });

    expect(problems).toStrictEqual([]);
  });

  test("下限に満たない短い単位は報告しない", () => {
    const problems = unitProblemsIn({
      "AGENTS.md": "- MUST: 記録する\n",
      "packages/example/AGENTS.md": "- MUST: 記録する\n",
    });

    expect(problems).toStrictEqual([]);
  });

  test("案内だけの単位は報告しない", () => {
    const pointer = `- 詳細は ${"リポジトリの規約を集めた文書".repeat(3)} を参照する\n`;
    const problems = unitProblemsIn({
      "AGENTS.md": pointer,
      "packages/example/AGENTS.md": pointer,
    });

    expect(problems).toStrictEqual([]);
  });
});
