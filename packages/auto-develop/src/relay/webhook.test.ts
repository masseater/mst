import { createHmac } from "node:crypto";

import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createMemoryEventStore } from "./memory-store.ts";
import { handleWebhook } from "./webhook.ts";

import type { EventStore } from "./store.ts";

const webhookConfig = {
  webhookSecret: "shared-secret",
  githubRepository: "example-org/example-repo",
};

const deliverWebhook = (delivery: {
  readonly events: EventStore;
  readonly eventType?: string | undefined;
  readonly deliveryId?: string | undefined;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly signedWith?: string;
}) => {
  const rawBody = JSON.stringify(delivery.payload);
  const secret = delivery.signedWith ?? webhookConfig.webhookSecret;
  return handleWebhook({
    rawBody,
    eventType: delivery.eventType,
    deliveryId: delivery.deliveryId,
    signatureHeader: `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
    config: webhookConfig,
    events: delivery.events,
    log: silentLogger,
  });
};

const allowedPayload = (payload: Readonly<Record<string, unknown>>) => ({
  repository: { full_name: "example-org/example-repo" },
  ...payload,
});

const excludedPullRequest = {
  number: 7,
  user: { login: "octocat" },
  labels: [{ name: "exclude-auto-develop" }],
};

const it = test
  .extend("acceptedDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({
        action: "opened",
        pull_request: { number: 7, user: { login: "octocat" }, body: "A long description." },
      }),
    });
    const [storedEvent] = await events.readSince(0);
    return { webhookResponse, storedEvent };
  })
  .extend("deliveryWithoutEventType", () =>
    deliverWebhook({
      events: createMemoryEventStore(),
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "opened" }),
    }),
  )
  .extend("deliveryWithForeignSignature", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "opened", pull_request: { number: 7 } }),
      signedWith: "another-secret",
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("pingDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "ping",
      deliveryId: "delivery-1",
      payload: { zen: "Design for failure." },
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("deliveryWithBrokenJson", () => {
    const rawBody = "{broken";
    return handleWebhook({
      rawBody,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      signatureHeader: `sha256=${createHmac("sha256", "shared-secret").update(rawBody).digest("hex")}`,
      config: webhookConfig,
      events: createMemoryEventStore(),
      log: silentLogger,
    });
  })
  .extend("deliveryFromForeignRepository", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: {
        repository: { full_name: "example-org/some-other-repo" },
        action: "opened",
        pull_request: { number: 7 },
      },
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("deliveryWithoutRepository", () =>
    deliverWebhook({
      events: createMemoryEventStore(),
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: { action: "opened", pull_request: { number: 7 } },
    }),
  )
  .extend("excludedPullDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "review_requested", pull_request: excludedPullRequest }),
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("closedExcludedPullDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "closed", pull_request: excludedPullRequest }),
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("exclusionLabelAddedDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({
        action: "labeled",
        pull_request: excludedPullRequest,
        label: { name: "exclude-auto-develop" },
      }),
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("exclusionLabelRemovedDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({
        action: "unlabeled",
        pull_request: excludedPullRequest,
        label: { name: "exclude-auto-develop" },
      }),
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("unrelatedLabelDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({
        action: "labeled",
        pull_request: excludedPullRequest,
        label: { name: "bug" },
      }),
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("excludedReviewDelivery", () =>
    deliverWebhook({
      events: createMemoryEventStore(),
      eventType: "pull_request_review",
      deliveryId: "delivery-1",
      payload: allowedPayload({
        action: "submitted",
        pull_request: excludedPullRequest,
        review: { body: "Fix.", state: "changes_requested" },
      }),
    }),
  )
  .extend("checkSuiteDelivery", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "check_suite",
      deliveryId: "delivery-1",
      payload: allowedPayload({
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
      }),
    });
    const storedEvents = await events.readSince(0);
    return { webhookResponse, storedEvents };
  })
  .extend("eventsAfterCloseDelivery", async () => {
    const events = createMemoryEventStore();
    await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "opened", pull_request: { number: 7 } }),
    });
    await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-2",
      payload: allowedPayload({ action: "closed", pull_request: { number: 7 } }),
    });
    return events.readSince(0);
  })
  .extend("closeDeliveryWithFailingDeletion", () => {
    const failingDeletion: EventStore = {
      ...createMemoryEventStore(),
      deleteForPr: () => Promise.reject(new Error("batch delete failed")),
    };
    return deliverWebhook({
      events: failingDeletion,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "closed", pull_request: { number: 7 } }),
    });
  });

describe("受信検証", () => {
  it("有効な webhook は 200 で受理される", ({ acceptedDelivery }) => {
    expect(acceptedDelivery.webhookResponse).toStrictEqual({
      status: 200,
      body: { accepted: true },
    });
  });

  it("有効な webhook は縮約して保存される", ({ acceptedDelivery }) => {
    expect(acceptedDelivery.storedEvent?.payload).toStrictEqual({
      action: "opened",
      pull_request: { number: 7, user: { login: "octocat" } },
    });
  });

  it("イベント種別ヘッダの欠落は 400 になる", ({ deliveryWithoutEventType }) => {
    expect(deliveryWithoutEventType).toStrictEqual({
      status: 400,
      body: { error: "Missing required headers" },
    });
  });

  it("署名不一致は 401 になる", ({ deliveryWithForeignSignature }) => {
    expect(deliveryWithForeignSignature.webhookResponse).toStrictEqual({
      status: 401,
      body: { error: "Invalid signature" },
    });
  });

  it("署名不一致は保存されない", ({ deliveryWithForeignSignature }) => {
    expect(deliveryWithForeignSignature.storedEvents).toStrictEqual([]);
  });

  it("ping は pong を返す", ({ pingDelivery }) => {
    expect(pingDelivery.webhookResponse).toStrictEqual({ status: 200, body: { pong: true } });
  });

  it("ping は保存しない", ({ pingDelivery }) => {
    expect(pingDelivery.storedEvents).toStrictEqual([]);
  });

  it("不正な JSON ボディは 400 になる", ({ deliveryWithBrokenJson }) => {
    expect(deliveryWithBrokenJson).toStrictEqual({
      status: 400,
      body: { error: "Invalid JSON body" },
    });
  });

  it("非許可リポジトリは 200 の skipped になる", ({ deliveryFromForeignRepository }) => {
    expect(deliveryFromForeignRepository.webhookResponse).toStrictEqual({
      status: 200,
      body: { skipped: true, reason: "repository not allowed" },
    });
  });

  it("非許可リポジトリは保存されない", ({ deliveryFromForeignRepository }) => {
    expect(deliveryFromForeignRepository.storedEvents).toStrictEqual([]);
  });

  it("repository フィールド欠落も非許可として扱う", ({ deliveryWithoutRepository }) => {
    expect(deliveryWithoutRepository.body).toStrictEqual({
      skipped: true,
      reason: "repository not allowed",
    });
  });
});

describe("除外ラベル", () => {
  it("除外ラベル付き PR のイベントは skipped になる", ({ excludedPullDelivery }) => {
    expect(excludedPullDelivery.webhookResponse.body).toStrictEqual({
      skipped: true,
      reason: "excluded by label",
    });
  });

  it("除外ラベル付き PR のイベントは保存されない", ({ excludedPullDelivery }) => {
    expect(excludedPullDelivery.storedEvents).toStrictEqual([]);
  });

  it("closed は除外ラベル付きでも受理される", ({ closedExcludedPullDelivery }) => {
    expect(closedExcludedPullDelivery.webhookResponse.body).toStrictEqual({ accepted: true });
  });

  it("closed は除外ラベル付きでも保存される", ({ closedExcludedPullDelivery }) => {
    expect(closedExcludedPullDelivery.storedEvents.length).toStrictEqual(1);
  });

  it("除外ラベル自体の付与は受理される", ({ exclusionLabelAddedDelivery }) => {
    expect(exclusionLabelAddedDelivery.webhookResponse.body).toStrictEqual({ accepted: true });
  });

  it("除外ラベル自体の付与は実行中セッションを止める合図として保存される", ({
    exclusionLabelAddedDelivery,
  }) => {
    expect(exclusionLabelAddedDelivery.storedEvents.length).toStrictEqual(1);
  });

  it("除外ラベル自体の除去は受理される", ({ exclusionLabelRemovedDelivery }) => {
    expect(exclusionLabelRemovedDelivery.webhookResponse.body).toStrictEqual({ accepted: true });
  });

  it("除外ラベル自体の除去は再開の合図として保存される", ({ exclusionLabelRemovedDelivery }) => {
    expect(exclusionLabelRemovedDelivery.storedEvents.length).toStrictEqual(1);
  });

  it("除外ラベルが付いたままの別ラベル付け外しは skipped になる", ({ unrelatedLabelDelivery }) => {
    expect(unrelatedLabelDelivery.webhookResponse.body).toStrictEqual({
      skipped: true,
      reason: "excluded by label",
    });
  });

  it("除外ラベルが付いたままの別ラベル付け外しは保存されない", ({ unrelatedLabelDelivery }) => {
    expect(unrelatedLabelDelivery.storedEvents).toStrictEqual([]);
  });

  it("除外ラベル付き PR の pull_request_review も保存されない", ({ excludedReviewDelivery }) => {
    expect(excludedReviewDelivery.body).toStrictEqual({
      skipped: true,
      reason: "excluded by label",
    });
  });

  it("check_suite は除外判定不能なので受理される", ({ checkSuiteDelivery }) => {
    expect(checkSuiteDelivery.webhookResponse.body).toStrictEqual({ accepted: true });
  });

  it("check_suite は除外判定不能なので常に保存される", ({ checkSuiteDelivery }) => {
    expect(checkSuiteDelivery.storedEvents.length).toStrictEqual(1);
  });
});

describe("close 時の後始末", () => {
  it("close の後に残るイベントは 1 件になる", ({ eventsAfterCloseDelivery }) => {
    expect(eventsAfterCloseDelivery.length).toStrictEqual(1);
  });

  it("close イベント自身を除いて対象 PR の保存済みイベントが削除される", ({
    eventsAfterCloseDelivery,
  }) => {
    expect(eventsAfterCloseDelivery[0]?.id).toStrictEqual("delivery-2");
  });

  it("削除の失敗は warn のみで応答は 200 のまま", ({ closeDeliveryWithFailingDeletion }) => {
    expect(closeDeliveryWithFailingDeletion).toStrictEqual({
      status: 200,
      body: { accepted: true },
    });
  });
});
