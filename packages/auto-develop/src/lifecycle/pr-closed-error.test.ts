import { describe, expect, test } from "vite-plus/test";

import { PrClosedError } from "./pr-closed-error.ts";
import { PrExcludedError } from "./pr-excluded-error.ts";

describe("PR lifecycle abort reasons", () => {
  test("クローズと除外はそれぞれ PR 番号入りのメッセージを持つ", () => {
    expect([new PrClosedError(7).message, new PrExcludedError(7).message]).toStrictEqual([
      "PR #7 was closed",
      "PR #7 was excluded from auto-develop",
    ]);
  });
});
