import { describe, expect, test } from "vite-plus/test";

import { generatedRanges, isInsideGeneratedRegion } from "./generated-region.ts";

const BOUNDARIES = [{ begin: "<!--BEGIN-->", end: "<!--END-->" }];

const it = test
  .extend("rangesOfADocumentThatOpensAndClosesARegion", () =>
    generatedRanges("prose\n<!--BEGIN-->\ngenerated\n<!--END-->\nmore\n", BOUNDARIES))
  .extend("rangesOfADocumentThatNeverOpensARegion", () =>
    generatedRanges("prose only\n", BOUNDARIES),
  )
  .extend("rangesOfADocumentThatOpensWithoutClosing", () =>
    generatedRanges("prose\n<!--BEGIN-->\ngenerated\n", BOUNDARIES),
  )
  .extend("verdictOnAnOffsetInsideTheRegion", () =>
    isInsideGeneratedRegion(
      19,
      generatedRanges("prose\n<!--BEGIN-->\ngenerated\n<!--END-->\nmore\n", BOUNDARIES),
    ),
  )
  .extend("verdictOnAnOffsetOutsideEveryRegion", () =>
    isInsideGeneratedRegion(
      0,
      generatedRanges("prose\n<!--BEGIN-->\ngenerated\n<!--END-->\nmore\n", BOUNDARIES),
    ),
  );

describe("generatedRanges", () => {
  it("a region that opens and closes is one range", ({
    rangesOfADocumentThatOpensAndClosesARegion,
  }) => {
    expect(rangesOfADocumentThatOpensAndClosesARegion).toStrictEqual([
      { startOffset: 6, endOffset: 39 },
    ]);
  });

  it("a document that never opens a region has none", ({
    rangesOfADocumentThatNeverOpensARegion,
  }) => {
    expect(rangesOfADocumentThatNeverOpensARegion).toStrictEqual([]);
  });

  it("a region that opens and never closes is not a range", ({
    rangesOfADocumentThatOpensWithoutClosing,
  }) => {
    expect(rangesOfADocumentThatOpensWithoutClosing).toStrictEqual([]);
  });
});

describe("isInsideGeneratedRegion", () => {
  it("an offset inside the region is inside it", ({ verdictOnAnOffsetInsideTheRegion }) => {
    expect(verdictOnAnOffsetInsideTheRegion).toBe(true);
  });

  it("an offset outside every region is outside them", ({
    verdictOnAnOffsetOutsideEveryRegion,
  }) => {
    expect(verdictOnAnOffsetOutsideEveryRegion).toBe(false);
  });
});
