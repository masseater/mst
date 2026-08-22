import { describe, expect, test } from "vite-plus/test";

import { generatedRanges, isInsideGeneratedRegion } from "./generated-region.ts";

const BOUNDARIES = [{ begin: "<!--BEGIN-->", end: "<!--END-->" }];

const DOCUMENT_OPENING_AND_CLOSING_A_REGION = "prose\n<!--BEGIN-->\ngenerated\n<!--END-->\nmore\n";

describe("generatedRanges", () => {
  describe("a document that opens a region and closes it", () => {
    const it = test.extend("ranges", () =>
      generatedRanges(DOCUMENT_OPENING_AND_CLOSING_A_REGION, BOUNDARIES));

    it("hands back one range spanning both boundaries and the text between them", ({ ranges }) => {
      expect(ranges).toStrictEqual([{ startOffset: 6, endOffset: 39 }]);
    });
  });

  describe("a document that never opens a region", () => {
    const it = test.extend("ranges", () => generatedRanges("prose only\n", BOUNDARIES));

    it("hands back no range at all", ({ ranges }) => {
      expect(ranges).toStrictEqual([]);
    });
  });

  describe("a document that opens a region and never closes it", () => {
    const it = test.extend("ranges", () =>
      generatedRanges("prose\n<!--BEGIN-->\ngenerated\n", BOUNDARIES));

    it("hands back no range at all", ({ ranges }) => {
      expect(ranges).toStrictEqual([]);
    });
  });
});

describe("isInsideGeneratedRegion", () => {
  describe("an offset standing between the boundaries of a region", () => {
    const it = test.extend("verdict", () =>
      isInsideGeneratedRegion(
        19,
        generatedRanges(DOCUMENT_OPENING_AND_CLOSING_A_REGION, BOUNDARIES),
      ));

    it("reads as inside the generated region", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("an offset standing ahead of every region", () => {
    const it = test.extend("verdict", () =>
      isInsideGeneratedRegion(
        0,
        generatedRanges(DOCUMENT_OPENING_AND_CLOSING_A_REGION, BOUNDARIES),
      ));

    it("reads as outside the generated region", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });
});
