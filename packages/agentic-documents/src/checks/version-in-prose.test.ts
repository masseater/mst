import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { versionLiteralsInProse } from "./version-in-prose.ts";

const versionProblemsIn = (source: string) =>
  versionLiteralsInProse({
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("versionLiteralsInProse", () => {
  test("除外の綴りに当たる版は報告しない", () => {
    const problems = versionLiteralsInProse({
      document: toNormativeDocument({
        file: "AGENTS.md",
        source: "v1 を使う\n",
        config: defaultConfig,
      }),
      config: { ...defaultConfig, versionExclusionPatterns: ["^v1$"] },
    });

    expect(problems).toStrictEqual([]);
  });

  test("接頭辞付きの版を報告する", () => {
    expect(versionProblemsIn("実行環境は v26.7.0 を使う\n").length).toStrictEqual(1);
  });

  test("範囲を表す記法の版を報告する", () => {
    expect(versionProblemsIn("依存は ^1.50.0 に固定する\n").length).toStrictEqual(1);
  });

  test("空白を挟んだ比較の表現は報告しない", () => {
    expect(versionProblemsIn("項目が > 18 件あるときは分割する\n")).toStrictEqual([]);
  });

  test("独立した領域のコード例は報告しない", () => {
    expect(versionProblemsIn('```json\n{ "node": "v26.7.0" }\n```\n')).toStrictEqual([]);
  });
});
