import { describe, expect, test } from "vite-plus/test";

import { extractBearer } from "./bearer.ts";

describe("extractBearer", () => {
  test("bearer スキームのクレデンシャルを取り出す", () => {
    expect(extractBearer("Bearer relay-credential")).toStrictEqual("relay-credential");
  });

  test("スキームの大文字小文字は無視される", () => {
    expect(extractBearer("BEARER relay-credential")).toStrictEqual("relay-credential");
  });

  test("ヘッダなしは提示なしになる", () => {
    expect(extractBearer(undefined)).toStrictEqual(undefined);
  });

  test("スペースを含まないヘッダは提示なしになる", () => {
    expect(extractBearer("Bearer")).toStrictEqual(undefined);
  });

  test("別スキームは提示なしになる", () => {
    expect(extractBearer("Basic dXNlcjpwYXNz")).toStrictEqual(undefined);
  });
});
