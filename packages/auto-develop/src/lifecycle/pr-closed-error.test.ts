import { describe, expect, test } from "vite-plus/test";

import { PrClosedError } from "./pr-closed-error.ts";
import { PrExcludedError } from "./pr-excluded-error.ts";

const it = test
  .extend("closedMessage", () => new PrClosedError(7).message)
  .extend("excludedMessage", () => new PrExcludedError(7).message);

describe("PR ライフサイクルの中断理由", () => {
  it("クローズは PR 番号入りのメッセージを持つ", ({ closedMessage }) => {
    expect(closedMessage).toStrictEqual("PR #7 was closed");
  });

  it("除外は PR 番号入りのメッセージを持つ", ({ excludedMessage }) => {
    expect(excludedMessage).toStrictEqual("PR #7 was excluded from auto-develop");
  });
});
