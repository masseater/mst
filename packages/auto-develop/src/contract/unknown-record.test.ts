import { describe, expect, test } from "vite-plus/test";

import { asRecord } from "./unknown-record.ts";

describe("asRecord", () => {
  describe("文字列キーのオブジェクト", () => {
    const it = test.extend("recordFromObject", () => asRecord({ login: "octocat" }));

    it("そのまま返る", ({ recordFromObject }) => {
      expect(recordFromObject).toStrictEqual({ login: "octocat" });
    });
  });

  describe("配列", () => {
    const it = test.extend("recordFromArray", () => asRecord([1, 2]));

    it("不採用になる", ({ recordFromArray }) => {
      expect(recordFromArray).toStrictEqual(undefined);
    });
  });

  describe("null", () => {
    const it = test.extend("recordFromNull", () => asRecord(null));

    it("不採用になる", ({ recordFromNull }) => {
      expect(recordFromNull).toStrictEqual(undefined);
    });
  });

  describe("文字列", () => {
    const it = test.extend("recordFromString", () => asRecord("octocat"));

    it("不採用になる", ({ recordFromString }) => {
      expect(recordFromString).toStrictEqual(undefined);
    });
  });
});
