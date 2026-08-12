import { describe, expect, test } from "vite-plus/test";

import { changedEndpoint } from "./input-change.ts";

describe("changedEndpoint", () => {
  test("base ブランチ名が変われば base", () => {
    expect(
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "develop", headRefOid: "abc" },
      }),
    ).toStrictEqual("base");
  });

  test("base 同名で head SHA が変われば head", () => {
    expect(
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "main", headRefOid: "def" },
      }),
    ).toStrictEqual("head");
  });

  test("base が前進しても同名なら変更なし", () => {
    expect(
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "main", headRefOid: "abc" },
      }),
    ).toStrictEqual(null);
  });

  test("両方変わった場合は base を優先して返す", () => {
    expect(
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "develop", headRefOid: "def" },
      }),
    ).toStrictEqual("base");
  });
});
