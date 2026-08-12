import { describe, expect, test } from "vite-plus/test";

import { listedTexts } from "./listed-texts.ts";

const it = test
  .extend("textsOfWrittenList", () => listedTexts(["src", "test"]))
  .extend("textsOfMixedList", () => listedTexts(["src", 7, null, { path: "test" }, ["test"]]))
  .extend("textsOfEmptyList", () => listedTexts([]))
  .extend("textsOfWrittenText", () => listedTexts("src"))
  .extend("textsOfNothing", () => listedTexts(undefined));

describe("listed-texts", () => {
  it("a list hands back every text written in it", ({ textsOfWrittenList }) => {
    expect(textsOfWrittenList).toStrictEqual(["src", "test"]);
  });

  it("an entry that is not a text is left out of what the list carries", ({ textsOfMixedList }) => {
    expect(textsOfMixedList).toStrictEqual(["src"]);
  });

  it("an empty list carries no text", ({ textsOfEmptyList }) => {
    expect(textsOfEmptyList).toStrictEqual([]);
  });

  it("a text written on its own carries no text", ({ textsOfWrittenText }) => {
    expect(textsOfWrittenText).toStrictEqual([]);
  });

  it("a missing value carries no text", ({ textsOfNothing }) => {
    expect(textsOfNothing).toStrictEqual([]);
  });
});
