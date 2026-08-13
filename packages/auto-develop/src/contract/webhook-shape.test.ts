import { describe, expect, test } from "vite-plus/test";

import { sealEnvelope, unwrapEnvelope } from "./envelope.ts";
import { filterEvent } from "./filter.ts";
import { toWebhookShape } from "./webhook-shape.ts";

describe("封筒の往復不変条件", () => {
  const it = test
    .extend("detailedReviewRequestRoundTrip", () => {
      const detailedReviewRequestShape = toWebhookShape({
        kind: "review-requested",
        pullNumber: 7,
        reviewerLogin: "octocat",
        title: "Add retry",
        draft: false,
      });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: detailedReviewRequestShape.eventType,
            deliveryId: "delivery-1",
            payload: detailedReviewRequestShape.payload,
          }),
        ),
        "reviewer",
      );
    })
    .extend("bareReviewRequestRoundTrip", () => {
      const bareReviewRequestShape = toWebhookShape({ kind: "review-requested", pullNumber: 7 });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: bareReviewRequestShape.eventType,
            deliveryId: "delivery-1",
            payload: bareReviewRequestShape.payload,
          }),
        ),
        "reviewer",
      );
    })
    .extend("headInputChangeRoundTrip", () => {
      const headInputChangeShape = toWebhookShape({
        kind: "review-input-changed",
        changedInput: "head",
        pullNumber: 7,
      });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: headInputChangeShape.eventType,
            deliveryId: "delivery-1",
            payload: headInputChangeShape.payload,
          }),
        ),
        "reviewer",
      );
    })
    .extend("baseInputChangeRoundTrip", () => {
      const baseInputChangeShape = toWebhookShape({
        kind: "review-input-changed",
        changedInput: "base",
        pullNumber: 7,
      });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: baseInputChangeShape.eventType,
            deliveryId: "delivery-1",
            payload: baseInputChangeShape.payload,
          }),
        ),
        "reviewer",
      );
    })
    .extend("sourceReviewRoundTrip", () => {
      const sourceReviewShape = toWebhookShape({
        kind: "source-review-submitted",
        pullNumber: 7,
        state: "changes_requested",
        body: "Fix the failing test.",
      });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: sourceReviewShape.eventType,
            deliveryId: "delivery-1",
            payload: sourceReviewShape.payload,
          }),
        ),
        "author",
      );
    })
    .extend("ciCompletionRoundTrip", () => {
      const ciCompletionShape = toWebhookShape({
        kind: "ci-completed",
        pullNumber: 7,
        conclusion: "failure",
        headSha: "0a1b2c3",
      });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: ciCompletionShape.eventType,
            deliveryId: "delivery-1",
            payload: ciCompletionShape.payload,
          }),
        ),
        "author",
      );
    })
    .extend("mergeConflictRoundTrip", () => {
      const mergeConflictShape = toWebhookShape({ kind: "merge-conflict", pullNumber: 7 });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: mergeConflictShape.eventType,
            deliveryId: "delivery-1",
            payload: mergeConflictShape.payload,
          }),
        ),
        "author",
      );
    })
    .extend("baseUpdateRoundTrip", () => {
      const baseUpdateShape = toWebhookShape({ kind: "base-update", pullNumber: 7 });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: baseUpdateShape.eventType,
            deliveryId: "delivery-1",
            payload: baseUpdateShape.payload,
          }),
        ),
        "author",
      );
    })
    .extend("closureRoundTripForAuthor", () => {
      const closureShapeForAuthor = toWebhookShape({ kind: "pr-closed", pullNumber: 7 });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: closureShapeForAuthor.eventType,
            deliveryId: "delivery-1",
            payload: closureShapeForAuthor.payload,
          }),
        ),
        "author",
      );
    })
    .extend("closureRoundTripForReviewer", () => {
      const closureShapeForReviewer = toWebhookShape({ kind: "pr-closed", pullNumber: 7 });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: closureShapeForReviewer.eventType,
            deliveryId: "delivery-1",
            payload: closureShapeForReviewer.payload,
          }),
        ),
        "reviewer",
      );
    })
    .extend("exclusionRoundTripForAuthor", () => {
      const exclusionShapeForAuthor = toWebhookShape({ kind: "pr-excluded", pullNumber: 7 });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: exclusionShapeForAuthor.eventType,
            deliveryId: "delivery-1",
            payload: exclusionShapeForAuthor.payload,
          }),
        ),
        "author",
      );
    })
    .extend("exclusionRoundTripForReviewer", () => {
      const exclusionShapeForReviewer = toWebhookShape({ kind: "pr-excluded", pullNumber: 7 });
      return filterEvent(
        unwrapEnvelope(
          sealEnvelope({
            eventType: exclusionShapeForReviewer.eventType,
            deliveryId: "delivery-1",
            payload: exclusionShapeForReviewer.payload,
          }),
        ),
        "reviewer",
      );
    });

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
  const it = test
    .extend("exclusionWebhookShape", () => toWebhookShape({ kind: "pr-excluded", pullNumber: 7 }))
    .extend("baseUpdateWebhookShape", () => toWebhookShape({ kind: "base-update", pullNumber: 7 }));

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
