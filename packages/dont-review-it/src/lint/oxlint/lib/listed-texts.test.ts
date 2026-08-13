import { describe, expect, test } from "vite-plus/test";

import { listedTexts } from "./listed-texts.ts";

describe("listedTexts", () => {
  describe("a list holding written texts", () => {
    const it = test.extend("texts", () => listedTexts(["src", "test"]));

    it("hands back every text written in it", ({ texts }) => {
      expect(texts).toStrictEqual(["src", "test"]);
    });
  });

  describe("a list holding entries that are not texts", () => {
    const it = test.extend("texts", () =>
      listedTexts(["src", 7, null, { path: "test" }, ["test"]]));

    it("leaves every entry that is not a text out of what the list carries", ({ texts }) => {
      expect(texts).toStrictEqual(["src"]);
    });
  });

  describe("an empty list", () => {
    const it = test.extend("texts", () => listedTexts([]));

    it("carries no text", ({ texts }) => {
      expect(texts).toStrictEqual([]);
    });
  });

  describe("a text written on its own", () => {
    const it = test.extend("texts", () => listedTexts("src"));

    it("carries no text", ({ texts }) => {
      expect(texts).toStrictEqual([]);
    });
  });

  describe("a missing value", () => {
    const it = test.extend("texts", () => listedTexts(undefined));

    it("carries no text", ({ texts }) => {
      expect(texts).toStrictEqual([]);
    });
  });
});
