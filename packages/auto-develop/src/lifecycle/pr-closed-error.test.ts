import { describe, expect, test } from "vite-plus/test";

import { PrClosedError } from "./pr-closed-error.ts";
import { PrExcludedError } from "./pr-excluded-error.ts";

describe("PR ライフサイクルの中断理由", () => {
  const it = test
    .extend("prClosedErrorText", () => new PrClosedError(7).toString())
    .extend("prExcludedErrorText", () => new PrExcludedError(7).toString());

  it("クローズは PR 番号入りのメッセージを持つ", ({ prClosedErrorText }) => {
    expect(prClosedErrorText).toStrictEqual("PrClosedError: PR #7 was closed");
  });

  it("除外は PR 番号入りのメッセージを持つ", ({ prExcludedErrorText }) => {
    expect(prExcludedErrorText).toStrictEqual(
      "PrExcludedError: PR #7 was excluded from auto-develop",
    );
  });
});
