import { describe, expect, test } from "vite-plus/test";

import { buildStyleClassIndex } from "./class-index.ts";

import type { StyleClassSite } from "./stylesheet-classes.ts";

const STYLE_SHEET_PATH = "apps/website/src/style.css";

const ORPHAN_STYLE_SHEET = ".orphan {\n  color: red;\n}\n";

const ORPHAN_SITES: readonly StyleClassSite[] = [{ name: "orphan", line: 1 }];

describe("buildStyleClassIndex", () => {
  describe("a class no reference text spells", () => {
    const it = test.extend("index", () =>
      buildStyleClassIndex({
        styleSheets: [{ relativePath: STYLE_SHEET_PATH, source: ORPHAN_STYLE_SHEET }],
        referenceTexts: [],
      }));

    it("is listed under its style sheet", ({ index }) => {
      expect(index).toStrictEqual({
        unusedByStyleSheet: new Map([[STYLE_SHEET_PATH, ORPHAN_SITES]]),
      });
    });
  });

  describe("a style sheet whose classes are all spelled", () => {
    const it = test.extend("index", () =>
      buildStyleClassIndex({
        styleSheets: [{ relativePath: STYLE_SHEET_PATH, source: ORPHAN_STYLE_SHEET }],
        referenceTexts: ['<div class="orphan"></div>'],
      }));

    it("is left out of the index", ({ index }) => {
      expect(index).toStrictEqual({ unusedByStyleSheet: new Map() });
    });
  });

  describe("a class spelled only through the prefix an interpolation builds on", () => {
    const it = test.extend("index", () =>
      buildStyleClassIndex({
        styleSheets: [
          { relativePath: STYLE_SHEET_PATH, source: ".ui-primary {\n  color: red;\n}\n" },
        ],
        referenceTexts: ["`ui-${kind}`"],
      }));

    it("is left out of the index", ({ index }) => {
      expect(index).toStrictEqual({ unusedByStyleSheet: new Map() });
    });
  });

  describe("a class that carries no separator", () => {
    const it = test.extend("index", () =>
      buildStyleClassIndex({
        styleSheets: [{ relativePath: STYLE_SHEET_PATH, source: ORPHAN_STYLE_SHEET }],
        referenceTexts: ["orph"],
      }));

    it("is judged by its whole name rather than by a leading part of it", ({ index }) => {
      expect(index).toStrictEqual({
        unusedByStyleSheet: new Map([[STYLE_SHEET_PATH, ORPHAN_SITES]]),
      });
    });
  });

  describe("two reference texts holding the opening and the ending of one name", () => {
    const it = test.extend("index", () =>
      buildStyleClassIndex({
        styleSheets: [{ relativePath: STYLE_SHEET_PATH, source: ORPHAN_STYLE_SHEET }],
        referenceTexts: ["orph", "an"],
      }));

    it("are read apart, so neither lends the other its ending", ({ index }) => {
      expect(index).toStrictEqual({
        unusedByStyleSheet: new Map([[STYLE_SHEET_PATH, ORPHAN_SITES]]),
      });
    });
  });
});
