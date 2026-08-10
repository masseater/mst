import { describe, expect, test } from "vite-plus/test";

import { buildStyleClassIndex } from "./class-index.ts";

import type { StyleClassSite } from "./stylesheet-classes.ts";

const STYLE_SHEET_PATH = "apps/website/src/style.css";

const ORPHAN_STYLE_SHEET = ".orphan {\n  color: red;\n}\n";

const ORPHAN_SITES: readonly StyleClassSite[] = [{ name: "orphan", line: 1 }];

describe("buildStyleClassIndex", () => {
  const unusedIn = (input: {
    readonly source: string;
    readonly referenceTexts: readonly string[];
  }): readonly (readonly [string, readonly StyleClassSite[]])[] => [
    ...buildStyleClassIndex({
      styleSheets: [{ relativePath: STYLE_SHEET_PATH, source: input.source }],
      referenceTexts: input.referenceTexts,
    }).unusedByStyleSheet,
  ];

  test("a class no reference text spells is listed under its style sheet", () => {
    expect(unusedIn({ source: ORPHAN_STYLE_SHEET, referenceTexts: [] })).toStrictEqual([
      [STYLE_SHEET_PATH, ORPHAN_SITES],
    ]);
  });

  test("a style sheet whose classes are all spelled is left out of the index", () => {
    expect(
      unusedIn({
        source: ORPHAN_STYLE_SHEET,
        referenceTexts: ['<div class="orphan"></div>'],
      }),
    ).toStrictEqual([]);
  });

  test("a class spelled only through the prefix an interpolation builds on is left out", () => {
    expect(
      unusedIn({ source: ".ui-primary {\n  color: red;\n}\n", referenceTexts: ["`ui-${kind}`"] }),
    ).toStrictEqual([]);
  });

  test("a class that carries no separator is judged by its whole name", () => {
    expect(unusedIn({ source: ORPHAN_STYLE_SHEET, referenceTexts: ["orph"] })).toStrictEqual([
      [STYLE_SHEET_PATH, ORPHAN_SITES],
    ]);
  });

  test("two reference texts are read apart, so neither lends the other its ending", () => {
    expect(unusedIn({ source: ORPHAN_STYLE_SHEET, referenceTexts: ["orph", "an"] })).toStrictEqual([
      [STYLE_SHEET_PATH, ORPHAN_SITES],
    ]);
  });
});
