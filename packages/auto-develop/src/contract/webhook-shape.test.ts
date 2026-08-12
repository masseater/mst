import { describe, expect, test } from "vite-plus/test";

import { sealEnvelope, unwrapEnvelope } from "./envelope.ts";
import { filterEvent } from "./filter.ts";
import { toWebhookShape } from "./webhook-shape.ts";

import type { FilteredEvent } from "./filtered-event.ts";
import type { Mode } from "./vocabulary.ts";

const roundTrip = (webhookEvent: FilteredEvent, spelledMode: Mode): FilteredEvent | null => {
  const shape = toWebhookShape(webhookEvent);
  const flattened = unwrapEnvelope(
    sealEnvelope({ eventType: shape.eventType, deliveryId: "delivery-1", payload: shape.payload }),
  );
  return filterEvent(flattened, spelledMode);
};

const it = test
  .extend("detailedReviewRequestRoundTrip", () =>
    roundTrip(
      {
        kind: "review-requested",
        pullNumber: 7,
        reviewerLogin: "octocat",
        title: "Add retry",
        draft: false,
      },
      "reviewer",
    ))
  .extend("bareReviewRequestRoundTrip", () =>
    roundTrip({ kind: "review-requested", pullNumber: 7 }, "reviewer"),
  )
  .extend("headInputChangeRoundTrip", () =>
    roundTrip({ kind: "review-input-changed", changedInput: "head", pullNumber: 7 }, "reviewer"),
  )
  .extend("baseInputChangeRoundTrip", () =>
    roundTrip({ kind: "review-input-changed", changedInput: "base", pullNumber: 7 }, "reviewer"),
  )
  .extend("sourceReviewRoundTrip", () =>
    roundTrip(
      {
        kind: "source-review-submitted",
        pullNumber: 7,
        state: "changes_requested",
        body: "Fix the failing test.",
      },
      "author",
    ),
  )
  .extend("ciCompletionRoundTrip", () =>
    roundTrip(
      { kind: "ci-completed", pullNumber: 7, conclusion: "failure", headSha: "0a1b2c3" },
      "author",
    ),
  )
  .extend("mergeConflictRoundTrip", () =>
    roundTrip({ kind: "merge-conflict", pullNumber: 7 }, "author"),
  )
  .extend("baseUpdateRoundTrip", () => roundTrip({ kind: "base-update", pullNumber: 7 }, "author"))
  .extend("closureRoundTripForAuthor", () =>
    roundTrip({ kind: "pr-closed", pullNumber: 7 }, "author"),
  )
  .extend("closureRoundTripForReviewer", () =>
    roundTrip({ kind: "pr-closed", pullNumber: 7 }, "reviewer"),
  )
  .extend("exclusionRoundTripForAuthor", () =>
    roundTrip({ kind: "pr-excluded", pullNumber: 7 }, "author"),
  )
  .extend("exclusionRoundTripForReviewer", () =>
    roundTrip({ kind: "pr-excluded", pullNumber: 7 }, "reviewer"),
  )
  .extend("exclusionWebhookShape", () => toWebhookShape({ kind: "pr-excluded", pullNumber: 7 }))
  .extend("baseUpdateWebhookShape", () => toWebhookShape({ kind: "base-update", pullNumber: 7 }));

describe("封筒の往復不変条件", () => {
  it("review-requested の全フィールドが reviewer で元に戻る", ({
    detailedReviewRequestRoundTrip,
  }) => {
    expect(detailedReviewRequestRoundTrip).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
      reviewerLogin: "octocat",
      title: "Add retry",
      draft: false,
      deliveryId: "delivery-1",
    });
  });

  it("review-requested の最小形が reviewer で元に戻る", ({ bareReviewRequestRoundTrip }) => {
    expect(bareReviewRequestRoundTrip).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("head 側の review-input-changed が reviewer で元に戻る", ({ headInputChangeRoundTrip }) => {
    expect(headInputChangeRoundTrip).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("base 側の review-input-changed が reviewer で元に戻る", ({ baseInputChangeRoundTrip }) => {
    expect(baseInputChangeRoundTrip).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "base",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("source-review-submitted が author で元に戻る", ({ sourceReviewRoundTrip }) => {
    expect(sourceReviewRoundTrip).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "Fix the failing test.",
      deliveryId: "delivery-1",
    });
  });

  it("ci-completed が author で元に戻る", ({ ciCompletionRoundTrip }) => {
    expect(ciCompletionRoundTrip).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
      deliveryId: "delivery-1",
    });
  });

  it("merge-conflict が author で元に戻る", ({ mergeConflictRoundTrip }) => {
    expect(mergeConflictRoundTrip).toStrictEqual({
      kind: "merge-conflict",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("base-update が author で元に戻る", ({ baseUpdateRoundTrip }) => {
    expect(baseUpdateRoundTrip).toStrictEqual({
      kind: "base-update",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("pr-closed が author で元に戻る", ({ closureRoundTripForAuthor }) => {
    expect(closureRoundTripForAuthor).toStrictEqual({
      kind: "pr-closed",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("pr-closed が reviewer で元に戻る", ({ closureRoundTripForReviewer }) => {
    expect(closureRoundTripForReviewer).toStrictEqual({
      kind: "pr-closed",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("pr-excluded が author で元に戻る", ({ exclusionRoundTripForAuthor }) => {
    expect(exclusionRoundTripForAuthor).toStrictEqual({
      kind: "pr-excluded",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("pr-excluded が reviewer で元に戻る", ({ exclusionRoundTripForReviewer }) => {
    expect(exclusionRoundTripForReviewer).toStrictEqual({
      kind: "pr-excluded",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });
});

describe("合成ペイロードの形", () => {
  it("pr-excluded は除外ラベル名を label.name に載せる", ({ exclusionWebhookShape }) => {
    expect(exclusionWebhookShape).toStrictEqual({
      eventType: "pull_request",
      payload: {
        action: "labeled",
        pull_request: { number: 7 },
        label: { name: "exclude-auto-develop" },
      },
    });
  });

  it("base-update は MERGEABLE と BEHIND を焼き込んだ synchronize になる", ({
    baseUpdateWebhookShape,
  }) => {
    expect(baseUpdateWebhookShape).toStrictEqual({
      eventType: "pull_request",
      payload: {
        action: "synchronize",
        pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
      },
    });
  });
});
