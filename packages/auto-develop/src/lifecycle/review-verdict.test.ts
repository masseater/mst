import { describe, expect, test } from "vite-plus/test";

import { effectiveReviewOf, reviewVerdictState } from "./review-verdict.ts";

describe("effectiveReviewOf", () => {
  const it = test
    .extend("latestEffectiveReview", () =>
      effectiveReviewOf({
        reviews: [
          {
            state: "APPROVED",
            body: "",
            submittedAt: "1",
            commitSha: "abc",
            authorLogin: "bot",
          },
          {
            state: "CHANGES_REQUESTED",
            body: "",
            submittedAt: "2",
            commitSha: "abc",
            authorLogin: "bot",
          },
        ],
        login: "bot",
      }))
    .extend("reviewIgnoringComments", () =>
      effectiveReviewOf({
        reviews: [
          {
            state: "APPROVED",
            body: "",
            submittedAt: "2026-08-11T00:00:00.000Z",
            commitSha: "abc",
            authorLogin: "bot",
          },
          {
            state: "COMMENTED",
            body: "",
            submittedAt: "2026-08-11T00:00:00.000Z",
            commitSha: "abc",
            authorLogin: "bot",
          },
        ],
        login: "bot",
      }),
    )
    .extend("reviewFromOtherLogin", () =>
      effectiveReviewOf({
        reviews: [
          {
            state: "CHANGES_REQUESTED",
            body: "",
            submittedAt: "2026-08-11T00:00:00.000Z",
            commitSha: "abc",
            authorLogin: "human",
          },
        ],
        login: "bot",
      }),
    )
    .extend("reviewFromEmptyList", () => effectiveReviewOf({ reviews: [], login: "bot" }));

  it("指定ログインの承認/変更要求のうち最新 1 件を返す", ({ latestEffectiveReview }) => {
    expect(latestEffectiveReview).toStrictEqual({
      state: "CHANGES_REQUESTED",
      body: "",
      submittedAt: "2",
      commitSha: "abc",
      authorLogin: "bot",
    });
  });

  it("コメントのみのレビューは判定に数えない", ({ reviewIgnoringComments }) => {
    expect(reviewIgnoringComments).toStrictEqual({
      state: "APPROVED",
      body: "",
      submittedAt: "2026-08-11T00:00:00.000Z",
      commitSha: "abc",
      authorLogin: "bot",
    });
  });

  it("別ログインのレビューは無視する", ({ reviewFromOtherLogin }) => {
    expect(reviewFromOtherLogin).toStrictEqual(null);
  });

  it("該当なしは null", ({ reviewFromEmptyList }) => {
    expect(reviewFromEmptyList).toStrictEqual(null);
  });
});

describe("reviewVerdictState", () => {
  const it = test
    .extend("stateForChangesRequested", () =>
      reviewVerdictState({
        state: "CHANGES_REQUESTED",
        body: "",
        submittedAt: "2026-08-11T00:00:00.000Z",
        commitSha: "abc",
        authorLogin: "bot",
      }))
    .extend("stateForApproved", () =>
      reviewVerdictState({
        state: "APPROVED",
        body: "",
        submittedAt: "2026-08-11T00:00:00.000Z",
        commitSha: "abc",
        authorLogin: "bot",
      }),
    )
    .extend("stateForNoReview", () => reviewVerdictState(null));

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
