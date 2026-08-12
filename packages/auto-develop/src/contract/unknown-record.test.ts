import { describe, expect, test } from "vite-plus/test";

import { asRecord } from "./unknown-record.ts";

const it = test
  .extend("recordFromObject", () => asRecord({ login: "octocat" }))
  .extend("recordFromArray", () => asRecord([1, 2]))
  .extend("recordFromNull", () => asRecord(null))
  .extend("recordFromString", () => asRecord("octocat"));

describe("asRecord", () => {
  it("文字列キーのオブジェクトはそのまま返る", ({ recordFromObject }) => {
    expect(recordFromObject).toStrictEqual({ login: "octocat" });
  });

  it("配列は不採用になる", ({ recordFromArray }) => {
    expect(recordFromArray).toStrictEqual(undefined);
  });

  it("null は不採用になる", ({ recordFromNull }) => {
    expect(recordFromNull).toStrictEqual(undefined);
  });

  it("文字列は不採用になる", ({ recordFromString }) => {
    expect(recordFromString).toStrictEqual(undefined);
  });
});
