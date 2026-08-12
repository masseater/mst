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

describe("effectiveReviewOf", () => {
  test("指定ログインの承認/変更要求のうち最新 1 件を返す", () => {
    const reviews = [
      review({ state: "APPROVED", submittedAt: "1" }),
      review({ state: "CHANGES_REQUESTED", submittedAt: "2" }),
    ];
    expect(effectiveReviewOf({ reviews, login: "bot" })?.state).toStrictEqual("CHANGES_REQUESTED");
  });

  test("コメントのみのレビューは判定に数えない", () => {
    const reviews = [review({ state: "APPROVED" }), review({ state: "COMMENTED" })];
    expect(effectiveReviewOf({ reviews, login: "bot" })?.state).toStrictEqual("APPROVED");
  });

  test("別ログインのレビューは無視する", () => {
    const reviews = [review({ state: "CHANGES_REQUESTED", authorLogin: "human" })];
    expect(effectiveReviewOf({ reviews, login: "bot" })).toStrictEqual(null);
  });

  test("該当なしは null", () => {
    expect(effectiveReviewOf({ reviews: [], login: "bot" })).toStrictEqual(null);
  });
});

describe("reviewVerdictState", () => {
  test("変更要求は error", () => {
    expect(reviewVerdictState(review({ state: "CHANGES_REQUESTED" }))).toStrictEqual("error");
  });

  test("承認は success", () => {
    expect(reviewVerdictState(review({ state: "APPROVED" }))).toStrictEqual("success");
  });

  test("実効レビューなし（null）は success 側に倒す", () => {
    expect(reviewVerdictState(null)).toStrictEqual("success");
  });
});
