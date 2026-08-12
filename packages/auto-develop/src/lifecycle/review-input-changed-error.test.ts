import { describe, expect, test } from "vite-plus/test";

import { PrClosedError } from "./pr-closed-error.ts";
import { isReviewInputChanged, ReviewInputChangedError } from "./review-input-changed-error.ts";

describe("ReviewInputChangedError", () => {
  test("PR 番号をメッセージに含む", () => {
    expect(new ReviewInputChangedError(7).message).toStrictEqual(
      "the review input for PR #7 changed",
    );
  });

  test("isReviewInputChanged は入力変更エラーだけを真にする", () => {
    expect([
      isReviewInputChanged(new ReviewInputChangedError(7)),
      isReviewInputChanged(new PrClosedError(7)),
      isReviewInputChanged("other"),
    ]).toStrictEqual([true, false, false]);
  });
});
