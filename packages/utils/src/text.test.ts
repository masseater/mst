import { describe, expect, test } from "vite-plus/test";

import { lineAtOffset, toLines } from "./text.ts";

const it = test
  .extend("emptyJoined", () => toLines([]))
  .extend("pairJoined", () => toLines(["first", "second"]))
  .extend("openingLineNumber", () => lineAtOffset("first\nsecond", 0))
  .extend("crossedLineNumber", () => lineAtOffset("first\nsecond", 6));

describe("toLines", () => {
  it("空の配列は空の文字列になる", ({ emptyJoined }) => {
    expect(emptyJoined).toStrictEqual("");
  });

  it("各要素の末尾に改行が付いて連結される", ({ pairJoined }) => {
    expect(pairJoined).toStrictEqual("first\nsecond\n");
  });
});

describe("lineAtOffset", () => {
  it("先頭のオフセットは 1 行目になる", ({ openingLineNumber }) => {
    expect(openingLineNumber).toStrictEqual(1);
  });

  it("改行をまたいだオフセットは次の行になる", ({ crossedLineNumber }) => {
    expect(crossedLineNumber).toStrictEqual(2);
  });
});
