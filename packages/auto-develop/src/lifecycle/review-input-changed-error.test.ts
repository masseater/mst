import { describe, expect, test } from "vite-plus/test";

import { PrClosedError } from "./pr-closed-error.ts";
import { isReviewInputChanged, ReviewInputChangedError } from "./review-input-changed-error.ts";

describe("ReviewInputChangedError", () => {
  const it = test
    .extend("reviewInputChangedErrorText", () => new ReviewInputChangedError(7).toString())
    .extend("verdictForChanged", () => isReviewInputChanged(new ReviewInputChangedError(7)))
    .extend("verdictForClosed", () => isReviewInputChanged(new PrClosedError(7)))
    .extend("verdictForNonError", () => isReviewInputChanged("other"));

  it("PR 番号をメッセージに含む", ({ reviewInputChangedErrorText }) => {
    expect(reviewInputChangedErrorText).toStrictEqual(
      "ReviewInputChangedError: the review input for PR #7 changed",
    );
  });

  it("入力変更エラーは入力変更として見分けられる", ({ verdictForChanged }) => {
    expect(verdictForChanged).toStrictEqual(true);
  });

  it("クローズのエラーは入力変更とみなさない", ({ verdictForClosed }) => {
    expect(verdictForClosed).toStrictEqual(false);
  });

  it("Error でない値は入力変更とみなさない", ({ verdictForNonError }) => {
    expect(verdictForNonError).toStrictEqual(false);
  });
});
