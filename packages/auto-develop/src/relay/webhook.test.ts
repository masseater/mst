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

describe("受信検証", () => {
  test("有効な webhook は縮約して保存され 200 で受理される", async () => {
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
    const [stored] = await events.readSince(0);
    expect([webhookResponse, stored?.payload]).toStrictEqual([
      { status: 200, body: { accepted: true } },
      { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
    ]);
  });

  test("イベント種別ヘッダの欠落は 400 になる", async () => {
    const webhookResponse = await deliverWebhook({
      events: createMemoryEventStore(),
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "opened" }),
    });
    expect(webhookResponse).toStrictEqual({
      status: 400,
      body: { error: "Missing required headers" },
    });
  });

  test("署名不一致は 401 になり保存されない", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "opened", pull_request: { number: 7 } }),
      signedWith: "another-secret",
    });
    expect([webhookResponse, await events.readSince(0)]).toStrictEqual([
      { status: 401, body: { error: "Invalid signature" } },
      [],
    ]);
  });

  test("ping は保存せず pong を返す", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "ping",
      deliveryId: "delivery-1",
      payload: { zen: "Design for failure." },
    });
    expect([webhookResponse, await events.readSince(0)]).toStrictEqual([
      { status: 200, body: { pong: true } },
      [],
    ]);
  });

  test("不正な JSON ボディは 400 になる", async () => {
    const rawBody = "{broken";
    const webhookResponse = await handleWebhook({
      rawBody,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      signatureHeader: `sha256=${createHmac("sha256", "shared-secret").update(rawBody).digest("hex")}`,
      config: webhookConfig,
      events: createMemoryEventStore(),
      log: silentLogger,
    });
    expect(webhookResponse).toStrictEqual({ status: 400, body: { error: "Invalid JSON body" } });
  });

  test("非許可リポジトリは 200 の skipped で保存されない", async () => {
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
    expect([webhookResponse, await events.readSince(0)]).toStrictEqual([
      { status: 200, body: { skipped: true, reason: "repository not allowed" } },
      [],
    ]);
  });

  test("repository フィールド欠落も非許可として扱う", async () => {
    const webhookResponse = await deliverWebhook({
      events: createMemoryEventStore(),
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: { action: "opened", pull_request: { number: 7 } },
    });
    expect(webhookResponse.body).toStrictEqual({ skipped: true, reason: "repository not allowed" });
  });
});

describe("除外ラベル", () => {
  const excludedPullRequest = {
    number: 7,
    user: { login: "octocat" },
    labels: [{ name: "exclude-auto-develop" }],
  };

  test("除外ラベル付き PR のイベントは保存されない", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "review_requested", pull_request: excludedPullRequest }),
    });
    expect([webhookResponse.body, await events.readSince(0)]).toStrictEqual([
      { skipped: true, reason: "excluded by label" },
      [],
    ]);
  });

  test("closed は除外ラベル付きでも保存される", async () => {
    const events = createMemoryEventStore();
    const webhookResponse = await deliverWebhook({
      events,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "closed", pull_request: excludedPullRequest }),
    });
    expect([webhookResponse.body, (await events.readSince(0)).length]).toStrictEqual([
      { accepted: true },
      1,
    ]);
  });

  test("除外ラベル自体の付与は実行中セッションを止める合図として保存される", async () => {
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
    expect([webhookResponse.body, (await events.readSince(0)).length]).toStrictEqual([
      { accepted: true },
      1,
    ]);
  });

  test("除外ラベル自体の除去は再開の合図として保存される", async () => {
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
    expect([webhookResponse.body, (await events.readSince(0)).length]).toStrictEqual([
      { accepted: true },
      1,
    ]);
  });

  test("除外ラベルが付いたままの別ラベル付け外しは保存されない", async () => {
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
    expect([webhookResponse.body, await events.readSince(0)]).toStrictEqual([
      { skipped: true, reason: "excluded by label" },
      [],
    ]);
  });

  test("除外ラベル付き PR の pull_request_review も保存されない", async () => {
    const webhookResponse = await deliverWebhook({
      events: createMemoryEventStore(),
      eventType: "pull_request_review",
      deliveryId: "delivery-1",
      payload: allowedPayload({
        action: "submitted",
        pull_request: excludedPullRequest,
        review: { body: "Fix.", state: "changes_requested" },
      }),
    });
    expect(webhookResponse.body).toStrictEqual({ skipped: true, reason: "excluded by label" });
  });

  test("check_suite は除外判定不能なので常に保存される", async () => {
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
    expect([webhookResponse.body, (await events.readSince(0)).length]).toStrictEqual([
      { accepted: true },
      1,
    ]);
  });
});

describe("close 時の後始末", () => {
  test("close イベント自身を除いて対象 PR の保存済みイベントが削除される", async () => {
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
    const remainingIds = (await events.readSince(0)).map((stored) => stored.id);
    expect(remainingIds).toStrictEqual(["delivery-2"]);
  });

  test("削除の失敗は warn のみで応答は 200 のまま", async () => {
    const events = createMemoryEventStore();
    const failingDeletion: EventStore = {
      ...events,
      deleteForPr: () => Promise.reject(new Error("batch delete failed")),
    };
    const webhookResponse = await deliverWebhook({
      events: failingDeletion,
      eventType: "pull_request",
      deliveryId: "delivery-1",
      payload: allowedPayload({ action: "closed", pull_request: { number: 7 } }),
    });
    expect(webhookResponse).toStrictEqual({ status: 200, body: { accepted: true } });
  });
});
