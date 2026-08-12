import { describe, expect, test } from "vite-plus/test";

import { PrClosedError } from "./pr-closed-error.ts";
import { isReviewInputChanged, ReviewInputChangedError } from "./review-input-changed-error.ts";

const it = test
  .extend("changedMessage", () => new ReviewInputChangedError(7).message)
  .extend("verdictForChanged", () => isReviewInputChanged(new ReviewInputChangedError(7)))
  .extend("verdictForClosed", () => isReviewInputChanged(new PrClosedError(7)))
  .extend("verdictForNonError", () => isReviewInputChanged("other"));

describe("ReviewInputChangedError", () => {
  it("PR 番号をメッセージに含む", ({ changedMessage }) => {
    expect(changedMessage).toStrictEqual("the review input for PR #7 changed");
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
