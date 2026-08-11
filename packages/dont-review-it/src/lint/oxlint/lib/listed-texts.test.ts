import { describe, expect, test } from "vite-plus/test";

import { listedTexts } from "./listed-texts.ts";

describe("listed-texts", () => {
  test("a list hands back every text written in it", () => {
    expect(listedTexts(["src", "test"])).toStrictEqual(["src", "test"]);
  });

  test("an entry that is not a text is left out of what the list carries", () => {
    expect(listedTexts(["src", 7, null, { path: "test" }, ["test"]])).toStrictEqual(["src"]);
  });

  test("an empty list carries no text", () => {
    expect(listedTexts([])).toStrictEqual([]);
  });

  test("a value written as anything but a list carries no text", () => {
    expect(listedTexts("src")).toStrictEqual([]);
    expect(listedTexts(undefined)).toStrictEqual([]);
  });
});
