import { describe, expect, it } from "vite-plus/test";

import { toLines } from "../src/text.ts";

describe("行の結合", () => {
  it("各要素を改行で終わる 1 つの文字列に畳む", () => {
    expect(toLines(["a", "b"])).toBe("a\nb\n");
  });
});
