import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { negatedKeywordSpellings } from "./prohibition-spelling.ts";

const spellingProblemsIn = (source: string) =>
  negatedKeywordSpellings({
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("negatedKeywordSpellings", () => {
  test("否定形の綴りを判断として使うと報告する", () => {
    expect(spellingProblemsIn("- MUST NOT: 省略する\n").length).toStrictEqual(1);
  });

  test("正の綴りは報告しない", () => {
    expect(spellingProblemsIn("- PROHIBIT: 省略する\n")).toStrictEqual([]);
  });

  test("区切りを伴わない綴りは判断ではないので報告しない", () => {
    expect(spellingProblemsIn("この文書では MUST NOT という語を説明する\n")).toStrictEqual([]);
  });
});
