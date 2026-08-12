import { describe, expect, test } from "vite-plus/test";

import { filterReviewEvent } from "./filter-review.ts";

const it = test
  .extend("changesRequestedVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "changes_requested", body: "Fix the failing test." },
        delivery_id: "delivery-1",
      },
      "author",
    ))
  .extend("upperCaseStateVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "CHANGES_REQUESTED", body: "Fix the failing test." },
      },
      "author",
    ),
  )
  .extend("nullBodyVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "changes_requested", body: null },
      },
      "author",
    ),
  )
  .extend("headRefBearingVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7, head: { ref: "topic/retry" } },
        review: { state: "changes_requested", body: "" },
      },
      "author",
    ),
  )
  .extend("approvedVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "approved", body: null },
      },
      "author",
    ),
  )
  .extend("commentedVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "commented", body: null },
      },
      "author",
    ),
  )
  .extend("reviewerModeVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "changes_requested", body: null },
      },
      "reviewer",
    ),
  )
  .extend("dismissedStateVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "dismissed", body: null },
      },
      "author",
    ),
  )
  .extend("dismissedActionVerdict", () =>
    filterReviewEvent(
      {
        action: "dismissed",
        pull_request: { number: 7 },
        review: { state: "changes_requested", body: null },
      },
      "author",
    ),
  )
  .extend("nullReviewVerdict", () =>
    filterReviewEvent({ action: "submitted", pull_request: { number: 7 }, review: null }, "author"),
  )
  .extend("numericStateVerdict", () =>
    filterReviewEvent(
      { action: "submitted", pull_request: { number: 7 }, review: { state: 7, body: null } },
      "author",
    ),
  )
  .extend("numericBodyVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: { number: 7 },
        review: { state: "changes_requested", body: 7 },
      },
      "author",
    ),
  )
  .extend("unnumberedPullVerdict", () =>
    filterReviewEvent(
      {
        action: "submitted",
        pull_request: {},
        review: { state: "changes_requested", body: null },
      },
      "author",
    ),
  );

describe("採用される形", () => {
  it("submitted と changes_requested は source-review-submitted になる", ({
    changesRequestedVerdict,
  }) => {
    expect(changesRequestedVerdict).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "Fix the failing test.",
      deliveryId: "delivery-1",
    });
  });

  it("大文字の state は小文字化して採用される", ({ upperCaseStateVerdict }) => {
    expect(upperCaseStateVerdict).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "Fix the failing test.",
    });
  });

  it("body が null なら空文字列に正規化される", ({ nullBodyVerdict }) => {
    expect(nullBodyVerdict).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "",
    });
  });

  it("pull_request.head.ref の有無は採否に影響しない", ({ headRefBearingVerdict }) => {
    expect(headRefBearingVerdict).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "",
    });
  });
});

describe("不採用になる形", () => {
  it("approved は著者作業を起動しない", ({ approvedVerdict }) => {
    expect(approvedVerdict).toStrictEqual(null);
  });

  it("commented は著者作業を起動しない", ({ commentedVerdict }) => {
    expect(commentedVerdict).toStrictEqual(null);
  });

  it("reviewer モードでは判定状態を問わず不採用になる", ({ reviewerModeVerdict }) => {
    expect(reviewerModeVerdict).toStrictEqual(null);
  });

  it("語彙外の state は不採用になる", ({ dismissedStateVerdict }) => {
    expect(dismissedStateVerdict).toStrictEqual(null);
  });

  it("submitted 以外の action は不採用になる", ({ dismissedActionVerdict }) => {
    expect(dismissedActionVerdict).toStrictEqual(null);
  });

  it("review が null なら不採用になる", ({ nullReviewVerdict }) => {
    expect(nullReviewVerdict).toStrictEqual(null);
  });

  it("state が文字列でなければ不採用になる", ({ numericStateVerdict }) => {
    expect(numericStateVerdict).toStrictEqual(null);
  });

  it("body が文字列でも null でもなければ不採用になる", ({ numericBodyVerdict }) => {
    expect(numericBodyVerdict).toStrictEqual(null);
  });

  it("pull_request.number が欠けていれば不採用になる", ({ unnumberedPullVerdict }) => {
    expect(unnumberedPullVerdict).toStrictEqual(null);
  });
});
