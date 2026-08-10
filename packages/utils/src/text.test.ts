import { describe, expect, test } from "vite-plus/test";

import { lineAtOffset, toLines } from "./text.ts";

describe("toLines", () => {
  test("空の配列は空の文字列になる", () => {
    expect(toLines([])).toStrictEqual("");
  });

  test("各要素の末尾に改行が付いて連結される", () => {
    expect(toLines(["first", "second"])).toStrictEqual("first\nsecond\n");
  });
});

describe("lineAtOffset", () => {
  test("先頭のオフセットは 1 行目になる", () => {
    expect(lineAtOffset("first\nsecond", 0)).toStrictEqual(1);
  });

  test("改行をまたいだオフセットは次の行になる", () => {
    expect(lineAtOffset("first\nsecond", 6)).toStrictEqual(2);
  });
});
