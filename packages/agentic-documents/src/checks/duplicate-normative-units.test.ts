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

const LONG_RULE = `- MUST: ${"実装の根拠をコードコメントに書かない。".repeat(12)}\n`;

describe("duplicatedNormativeUnits", () => {
  test("箇条書きでない段落も規範の単位として数える", () => {
    const paragraph =
      "同じ段落がそのまま写されている。十分に長い本文をここに置いて単位として数えさせる。\n";
    const problems = unitProblemsIn({
      "AGENTS.md": paragraph,
      "packages/example/AGENTS.md": paragraph,
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("引用の中や見出しの下にあっても同じ規範は写しとして数える", () => {
    const problems = unitProblemsIn({
      "AGENTS.md": `# 見出し\n\n> ${REPEATED_RULE}`,
      "packages/example/AGENTS.md": REPEATED_RULE,
    });

    expect(problems.length).toStrictEqual(1);
  });

  test("長い規範は報告の中で切り詰められる", () => {
    const problems = unitProblemsIn({
      "AGENTS.md": LONG_RULE,
      "packages/example/AGENTS.md": LONG_RULE,
    });

    expect(problems[0]?.message).toContain("…");
  });

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
