import { describe, expect, test } from "vite-plus/test";

import { effectiveReviewOf, reviewVerdictState, type Review } from "./review-verdict.ts";

const review = (shape: Partial<Review>): Review => ({
  state: "APPROVED",
  body: "",
  submittedAt: "2026-08-11T00:00:00.000Z",
  commitSha: "abc",
  authorLogin: "bot",
  ...shape,
});

const it = test
  .extend("latestEffectiveReview", () =>
    effectiveReviewOf({
      reviews: [
        review({ state: "APPROVED", submittedAt: "1" }),
        review({ state: "CHANGES_REQUESTED", submittedAt: "2" }),
      ],
      login: "bot",
    }))
  .extend("reviewIgnoringComments", () =>
    effectiveReviewOf({
      reviews: [review({ state: "APPROVED" }), review({ state: "COMMENTED" })],
      login: "bot",
    }),
  )
  .extend("reviewFromOtherLogin", () =>
    effectiveReviewOf({
      reviews: [review({ state: "CHANGES_REQUESTED", authorLogin: "human" })],
      login: "bot",
    }),
  )
  .extend("reviewFromEmptyList", () => effectiveReviewOf({ reviews: [], login: "bot" }))
  .extend("stateForChangesRequested", () =>
    reviewVerdictState(review({ state: "CHANGES_REQUESTED" })),
  )
  .extend("stateForApproved", () => reviewVerdictState(review({ state: "APPROVED" })))
  .extend("stateForNoReview", () => reviewVerdictState(null));

describe("effectiveReviewOf", () => {
  it("指定ログインの承認/変更要求のうち最新 1 件を返す", ({ latestEffectiveReview }) => {
    expect(latestEffectiveReview?.state).toStrictEqual("CHANGES_REQUESTED");
  });

  it("コメントのみのレビューは判定に数えない", ({ reviewIgnoringComments }) => {
    expect(reviewIgnoringComments?.state).toStrictEqual("APPROVED");
  });

  it("別ログインのレビューは無視する", ({ reviewFromOtherLogin }) => {
    expect(reviewFromOtherLogin).toStrictEqual(null);
  });

  it("該当なしは null", ({ reviewFromEmptyList }) => {
    expect(reviewFromEmptyList).toStrictEqual(null);
  });
});

describe("reviewVerdictState", () => {
  it("変更要求は error", ({ stateForChangesRequested }) => {
    expect(stateForChangesRequested).toStrictEqual("error");
  });

  it("承認は success", ({ stateForApproved }) => {
    expect(stateForApproved).toStrictEqual("success");
  });

  it("実効レビューなし（null）は success 側に倒す", ({ stateForNoReview }) => {
    expect(stateForNoReview).toStrictEqual("success");
  });
});
