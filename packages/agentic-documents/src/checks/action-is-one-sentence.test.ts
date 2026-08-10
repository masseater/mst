import { describe, expect, test } from "vite-plus/test";

import { defaultConfig } from "../config.ts";
import { toNormativeDocument } from "../scan/normative-documents.ts";
import { rationaleOnActionLine } from "./action-is-one-sentence.ts";

const rationaleProblemsIn = (source: string) =>
  rationaleOnActionLine({
    document: toNormativeDocument({ file: "AGENTS.md", source, config: defaultConfig }),
    config: defaultConfig,
  });

describe("rationaleOnActionLine", () => {
  test("行動の行に 2 文目があると報告する", () => {
    expect(
      rationaleProblemsIn("- MUST: 記録する。記録が無いと後から辿れないためである。\n").length,
    ).toStrictEqual(1);
  });

  test("行動が 1 文なら報告しない", () => {
    expect(rationaleProblemsIn("- MUST: 記録する。\n")).toStrictEqual([]);
  });

  test("条件を持つ項目でも行動が 1 文なら報告しない", () => {
    expect(rationaleProblemsIn("- IF: 開始する; THEN MUST: 記録する\n")).toStrictEqual([]);
  });

  test("判断キーワードを持たない項目は対象にしない", () => {
    expect(rationaleProblemsIn("- 記録する。理由はここに書く。\n")).toStrictEqual([]);
  });
});
