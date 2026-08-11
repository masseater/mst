import { describe, expect, test } from "vite-plus/test";

import { asRecord } from "./unknown-record.ts";

describe("asRecord", () => {
  test("文字列キーのオブジェクトはそのまま返る", () => {
    expect(asRecord({ login: "octocat" })).toStrictEqual({ login: "octocat" });
  });

  test("配列は不採用になる", () => {
    expect(asRecord([1, 2])).toStrictEqual(undefined);
  });

  test("null は不採用になる", () => {
    expect(asRecord(null)).toStrictEqual(undefined);
  });

  test("文字列は不採用になる", () => {
    expect(asRecord("octocat")).toStrictEqual(undefined);
  });
});
