import { describe, expect, test } from "vite-plus/test";

import { filterReviewEvent } from "./filter-review.ts";

describe("採用される形", () => {
  test("submitted と changes_requested は source-review-submitted になる", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "changes_requested", body: "Fix the failing test." },
      delivery_id: "delivery-1",
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "Fix the failing test.",
      deliveryId: "delivery-1",
    });
  });

  test("大文字の state は小文字化して採用される", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "CHANGES_REQUESTED", body: "Fix the failing test." },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "Fix the failing test.",
    });
  });

  test("body が null なら空文字列に正規化される", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "changes_requested", body: null },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "",
    });
  });

  test("pull_request.head.ref の有無は採否に影響しない", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7, head: { ref: "topic/retry" } },
      review: { state: "changes_requested", body: "" },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "",
    });
  });
});

describe("不採用になる形", () => {
  test("approved は著者作業を起動しない", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "approved", body: null },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });

  test("commented は著者作業を起動しない", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "commented", body: null },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });

  test("reviewer モードでは判定状態を問わず不採用になる", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "changes_requested", body: null },
    };
    expect(filterReviewEvent(event, "reviewer")).toStrictEqual(null);
  });

  test("語彙外の state は不採用になる", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "dismissed", body: null },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });

  test("submitted 以外の action は不採用になる", () => {
    const event = {
      action: "dismissed",
      pull_request: { number: 7 },
      review: { state: "changes_requested", body: null },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });

  test("review が null なら不採用になる", () => {
    const event = { action: "submitted", pull_request: { number: 7 }, review: null };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });

  test("state が文字列でなければ不採用になる", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: 7, body: null },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });

  test("body が文字列でも null でもなければ不採用になる", () => {
    const event = {
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "changes_requested", body: 7 },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });

  test("pull_request.number が欠けていれば不採用になる", () => {
    const event = {
      action: "submitted",
      pull_request: {},
      review: { state: "changes_requested", body: null },
    };
    expect(filterReviewEvent(event, "author")).toStrictEqual(null);
  });
});
