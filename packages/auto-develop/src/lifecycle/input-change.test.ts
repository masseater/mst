import { describe, expect, test } from "vite-plus/test";

import { changedEndpoint } from "./input-change.ts";

describe("changedEndpoint", () => {
  const it = test
    .extend("retargetedEndpoint", () =>
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "develop", headRefOid: "abc" },
      }))
    .extend("newCommitEndpoint", () =>
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "main", headRefOid: "def" },
      }),
    )
    .extend("unchangedEndpoint", () =>
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "main", headRefOid: "abc" },
      }),
    )
    .extend("bothChangedEndpoint", () =>
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "develop", headRefOid: "def" },
      }),
    );

  it("base ブランチ名が変われば base", ({ retargetedEndpoint }) => {
    expect(retargetedEndpoint).toStrictEqual("base");
  });

  it("base 同名で head SHA が変われば head", ({ newCommitEndpoint }) => {
    expect(newCommitEndpoint).toStrictEqual("head");
  });

  it("base が前進しても同名なら変更なし", ({ unchangedEndpoint }) => {
    expect(unchangedEndpoint).toStrictEqual(null);
  });

  it("両方変わった場合は base を優先して返す", ({ bothChangedEndpoint }) => {
    expect(bothChangedEndpoint).toStrictEqual("base");
  });
});
