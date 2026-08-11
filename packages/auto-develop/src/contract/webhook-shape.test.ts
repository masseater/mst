import { describe, expect, test } from "vite-plus/test";

import { sealEnvelope, unwrapEnvelope } from "./envelope.ts";
import { filterEvent } from "./filter.ts";
import { toWebhookShape } from "./webhook-shape.ts";

import type { FilteredEvent } from "./filtered-event.ts";
import type { Mode } from "./vocabulary.ts";

const roundTrip = (event: FilteredEvent, mode: Mode): FilteredEvent | null => {
  const shape = toWebhookShape(event);
  const flattened = unwrapEnvelope(
    sealEnvelope({ eventType: shape.eventType, deliveryId: "delivery-1", payload: shape.payload }),
  );
  return filterEvent(flattened, mode);
};

describe("封筒の往復不変条件", () => {
  test("review-requested の全フィールドが reviewer で元に戻る", () => {
    const event: FilteredEvent = {
      kind: "review-requested",
      pullNumber: 7,
      reviewerLogin: "octocat",
      title: "Add retry",
      draft: false,
    };
    expect(roundTrip(event, "reviewer")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("review-requested の最小形が reviewer で元に戻る", () => {
    const event: FilteredEvent = { kind: "review-requested", pullNumber: 7 };
    expect(roundTrip(event, "reviewer")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("head 側の review-input-changed が reviewer で元に戻る", () => {
    const event: FilteredEvent = {
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: 7,
    };
    expect(roundTrip(event, "reviewer")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("base 側の review-input-changed が reviewer で元に戻る", () => {
    const event: FilteredEvent = {
      kind: "review-input-changed",
      changedInput: "base",
      pullNumber: 7,
    };
    expect(roundTrip(event, "reviewer")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("source-review-submitted が author で元に戻る", () => {
    const event: FilteredEvent = {
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "Fix the failing test.",
    };
    expect(roundTrip(event, "author")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("ci-completed が author で元に戻る", () => {
    const event: FilteredEvent = {
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
    };
    expect(roundTrip(event, "author")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("merge-conflict が author で元に戻る", () => {
    const event: FilteredEvent = { kind: "merge-conflict", pullNumber: 7 };
    expect(roundTrip(event, "author")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("base-update が author で元に戻る", () => {
    const event: FilteredEvent = { kind: "base-update", pullNumber: 7 };
    expect(roundTrip(event, "author")).toStrictEqual({ ...event, deliveryId: "delivery-1" });
  });

  test("pr-closed が両モードで元に戻る", () => {
    const event: FilteredEvent = { kind: "pr-closed", pullNumber: 7 };
    expect([roundTrip(event, "author"), roundTrip(event, "reviewer")]).toStrictEqual([
      { ...event, deliveryId: "delivery-1" },
      { ...event, deliveryId: "delivery-1" },
    ]);
  });

  test("pr-excluded が両モードで元に戻る", () => {
    const event: FilteredEvent = { kind: "pr-excluded", pullNumber: 7 };
    expect([roundTrip(event, "author"), roundTrip(event, "reviewer")]).toStrictEqual([
      { ...event, deliveryId: "delivery-1" },
      { ...event, deliveryId: "delivery-1" },
    ]);
  });
});

describe("合成ペイロードの形", () => {
  test("pr-excluded は除外ラベル名を label.name に載せる", () => {
    expect(toWebhookShape({ kind: "pr-excluded", pullNumber: 7 })).toStrictEqual({
      eventType: "pull_request",
      payload: {
        action: "labeled",
        pull_request: { number: 7 },
        label: { name: "exclude-auto-develop" },
      },
    });
  });

  test("base-update は MERGEABLE と BEHIND を焼き込んだ synchronize になる", () => {
    expect(toWebhookShape({ kind: "base-update", pullNumber: 7 })).toStrictEqual({
      eventType: "pull_request",
      payload: {
        action: "synchronize",
        pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
      },
    });
  });
});
