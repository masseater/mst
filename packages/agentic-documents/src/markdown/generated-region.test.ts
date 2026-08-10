import { describe, expect, test } from "vite-plus/test";

import { generatedRanges, isInsideGeneratedRegion } from "./generated-region.ts";

const BOUNDARIES = [{ begin: "<!--BEGIN-->", end: "<!--END-->" }];

const rangesIn = (source: string) => generatedRanges(source, BOUNDARIES);

describe("generatedRanges", () => {
  test("a region that opens and closes is one range", () => {
    const source = "prose\n<!--BEGIN-->\ngenerated\n<!--END-->\nmore\n";

    expect(rangesIn(source)).toStrictEqual([
      {
        startOffset: source.indexOf("<!--BEGIN-->"),
        endOffset: source.indexOf("<!--END-->") + "<!--END-->".length,
      },
    ]);
  });

  test("a document that never opens a region has none", () => {
    expect(rangesIn("prose only\n")).toStrictEqual([]);
  });

  test("a region that opens and never closes is not a range", () => {
    expect(rangesIn("prose\n<!--BEGIN-->\ngenerated\n")).toStrictEqual([]);
  });
});

describe("isInsideGeneratedRegion", () => {
  const source = "prose\n<!--BEGIN-->\ngenerated\n<!--END-->\nmore\n";

  test("an offset inside the region is inside it", () => {
    expect(isInsideGeneratedRegion(source.indexOf("generated"), rangesIn(source))).toBe(true);
  });

  test("an offset outside every region is outside them", () => {
    expect(isInsideGeneratedRegion(0, rangesIn(source))).toBe(false);
  });
});
