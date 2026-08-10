import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { contrastiveCodePairs } from "./contrastive-code-pair.ts";

const pairProblemsIn = (source: string) =>
  contrastiveCodePairs({
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("contrastiveCodePairs", () => {
  test("同じ節に置かれた対の例を両方報告する", () => {
    const source =
      "## 書き方\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n\n良い例:\n\n```ts\nconst count = 1;\n```\n";

    expect(pairProblemsIn(source).length).toStrictEqual(2);
  });

  test("片方の印しか無い節は報告しない", () => {
    const source = "## 書き方\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n";

    expect(pairProblemsIn(source)).toStrictEqual([]);
  });

  test("別の節に分かれていれば報告しない", () => {
    const source =
      "## 避ける形\n\n悪い例:\n\n```ts\nconst a = 1;\n```\n\n## 望ましい形\n\n良い例:\n\n```ts\nconst count = 1;\n```\n";

    expect(pairProblemsIn(source)).toStrictEqual([]);
  });

  test("印を持たないコードは報告しない", () => {
    const source = "## 書き方\n\n```ts\nconst count = 1;\n```\n\n```ts\nconst total = 2;\n```\n";

    expect(pairProblemsIn(source)).toStrictEqual([]);
  });
});
