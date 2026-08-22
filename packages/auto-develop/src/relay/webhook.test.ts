import { createHmac } from "node:crypto";

import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { EVENT_TTL_MS } from "./durations.ts";
import { createMemoryEventStore } from "./memory-event-store.ts";
import { handleWebhook } from "./webhook.ts";

import type { EventStore } from "./store.ts";

const webhookConfig = {
  webhookSecret: "shared-secret",
  githubRepository: "example-org/example-repo",
};

const excludedPullRequest = {
  number: 7,
  user: { login: "octocat" },
  labels: [{ name: "exclude-auto-develop" }],
};

const STORED_AT_MS = 1_700_000_000_000;

describe("受信検証", () => {
  const it = test
    .extend("acceptedDeliveryResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "opened",
        pull_request: { number: 7, user: { login: "octocat" }, body: "A long description." },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForAcceptedDelivery", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "opened",
        pull_request: { number: 7, user: { login: "octocat" }, body: "A long description." },
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("deliveryWithoutEventTypeResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "opened",
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: undefined,
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("foreignSignatureResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "opened",
        pull_request: { number: 7 },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", "another-secret").update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForForeignSignature", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "opened",
        pull_request: { number: 7 },
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", "another-secret").update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("pingResponse", () => {
      const requestBody = JSON.stringify({ zen: "Design for failure." });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "ping",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForPing", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({ zen: "Design for failure." });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "ping",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("brokenJsonResponse", () => {
      const requestBody = "{broken";
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("foreignRepositoryResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: "example-org/some-other-repo" },
        action: "opened",
        pull_request: { number: 7 },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForForeignRepository", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: "example-org/some-other-repo" },
        action: "opened",
        pull_request: { number: 7 },
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("deliveryWithoutRepositoryResponse", () => {
      const requestBody = JSON.stringify({ action: "opened", pull_request: { number: 7 } });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    });

  it("有効な webhook は 200 で受理される", ({ acceptedDeliveryResponse }) => {
    expect(acceptedDeliveryResponse).toStrictEqual({ status: 200, body: { accepted: true } });
  });

  it("有効な webhook は縮約して保存される", ({ eventsStoredForAcceptedDelivery }) => {
    expect(eventsStoredForAcceptedDelivery).toStrictEqual([
      {
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: {
          action: "opened",
          pull_request: { number: 7, user: { login: "octocat" } },
        },
        receivedAtMs: STORED_AT_MS,
        expiresAtMs: STORED_AT_MS + EVENT_TTL_MS,
      },
    ]);
  });

  it("イベント種別ヘッダの欠落は 400 になる", ({ deliveryWithoutEventTypeResponse }) => {
    expect(deliveryWithoutEventTypeResponse).toStrictEqual({
      status: 400,
      body: { error: "Missing required headers" },
    });
  });

  it("署名不一致は 401 になる", ({ foreignSignatureResponse }) => {
    expect(foreignSignatureResponse).toStrictEqual({
      status: 401,
      body: { error: "Invalid signature" },
    });
  });

  it("署名不一致は保存されない", ({ eventsStoredForForeignSignature }) => {
    expect(eventsStoredForForeignSignature).toStrictEqual([]);
  });

  it("ping は pong を返す", ({ pingResponse }) => {
    expect(pingResponse).toStrictEqual({ status: 200, body: { pong: true } });
  });

  it("ping は保存しない", ({ eventsStoredForPing }) => {
    expect(eventsStoredForPing).toStrictEqual([]);
  });

  it("不正な JSON ボディは 400 になる", ({ brokenJsonResponse }) => {
    expect(brokenJsonResponse).toStrictEqual({
      status: 400,
      body: { error: "Invalid JSON body" },
    });
  });

  it("非許可リポジトリは 200 の skipped になる", ({ foreignRepositoryResponse }) => {
    expect(foreignRepositoryResponse).toStrictEqual({
      status: 200,
      body: { skipped: true, reason: "repository not allowed" },
    });
  });

  it("非許可リポジトリは保存されない", ({ eventsStoredForForeignRepository }) => {
    expect(eventsStoredForForeignRepository).toStrictEqual([]);
  });

  it("repository フィールド欠落も非許可として扱う", ({ deliveryWithoutRepositoryResponse }) => {
    expect(deliveryWithoutRepositoryResponse).toStrictEqual({
      status: 200,
      body: { skipped: true, reason: "repository not allowed" },
    });
  });
});

describe("除外ラベル", () => {
  const it = test
    .extend("excludedPullResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "review_requested",
        pull_request: excludedPullRequest,
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForExcludedPull", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "review_requested",
        pull_request: excludedPullRequest,
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("closedExcludedPullResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "closed",
        pull_request: excludedPullRequest,
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForClosedExcludedPull", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "closed",
        pull_request: excludedPullRequest,
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("exclusionLabelAddedResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "labeled",
        pull_request: excludedPullRequest,
        label: { name: "exclude-auto-develop" },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForExclusionLabelAdded", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "labeled",
        pull_request: excludedPullRequest,
        label: { name: "exclude-auto-develop" },
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("exclusionLabelRemovedResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "unlabeled",
        pull_request: excludedPullRequest,
        label: { name: "exclude-auto-develop" },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForExclusionLabelRemoved", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "unlabeled",
        pull_request: excludedPullRequest,
        label: { name: "exclude-auto-develop" },
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("unrelatedLabelResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "labeled",
        pull_request: excludedPullRequest,
        label: { name: "bug" },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForUnrelatedLabel", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "labeled",
        pull_request: excludedPullRequest,
        label: { name: "bug" },
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("excludedReviewResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "submitted",
        pull_request: excludedPullRequest,
        review: { body: "Fix.", state: "changes_requested" },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request_review",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("checkSuiteResponse", () => {
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "check_suite",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: createMemoryEventStore(),
        log: silentLogger,
      });
    })
    .extend("eventsStoredForCheckSuite", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
      });
      await handleWebhook({
        rawBody: requestBody,
        eventType: "check_suite",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    });

  it("除外ラベル付き PR のイベントは skipped になる", ({ excludedPullResponse }) => {
    expect(excludedPullResponse).toStrictEqual({
      status: 200,
      body: { skipped: true, reason: "excluded by label" },
    });
  });

  it("除外ラベル付き PR のイベントは保存されない", ({ eventsStoredForExcludedPull }) => {
    expect(eventsStoredForExcludedPull).toStrictEqual([]);
  });

  it("closed は除外ラベル付きでも受理される", ({ closedExcludedPullResponse }) => {
    expect(closedExcludedPullResponse).toStrictEqual({
      status: 200,
      body: { accepted: true },
    });
  });

  it("closed は除外ラベル付きでも保存される", ({ eventsStoredForClosedExcludedPull }) => {
    expect(eventsStoredForClosedExcludedPull).toStrictEqual([
      {
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: {
          action: "closed",
          pull_request: {
            number: 7,
            user: { login: "octocat" },
            labels: [{ name: "exclude-auto-develop" }],
          },
        },
        receivedAtMs: STORED_AT_MS,
        expiresAtMs: STORED_AT_MS + EVENT_TTL_MS,
      },
    ]);
  });

  it("除外ラベル自体の付与は受理される", ({ exclusionLabelAddedResponse }) => {
    expect(exclusionLabelAddedResponse).toStrictEqual({
      status: 200,
      body: { accepted: true },
    });
  });

  it("除外ラベル自体の付与は実行中セッションを止める合図として保存される", ({
    eventsStoredForExclusionLabelAdded,
  }) => {
    expect(eventsStoredForExclusionLabelAdded).toStrictEqual([
      {
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: {
          action: "labeled",
          pull_request: {
            number: 7,
            user: { login: "octocat" },
            labels: [{ name: "exclude-auto-develop" }],
          },
          label: { name: "exclude-auto-develop" },
        },
        receivedAtMs: STORED_AT_MS,
        expiresAtMs: STORED_AT_MS + EVENT_TTL_MS,
      },
    ]);
  });

  it("除外ラベル自体の除去は受理される", ({ exclusionLabelRemovedResponse }) => {
    expect(exclusionLabelRemovedResponse).toStrictEqual({
      status: 200,
      body: { accepted: true },
    });
  });

  it("除外ラベル自体の除去は再開の合図として保存される", ({
    eventsStoredForExclusionLabelRemoved,
  }) => {
    expect(eventsStoredForExclusionLabelRemoved).toStrictEqual([
      {
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: {
          action: "unlabeled",
          pull_request: {
            number: 7,
            user: { login: "octocat" },
            labels: [{ name: "exclude-auto-develop" }],
          },
          label: { name: "exclude-auto-develop" },
        },
        receivedAtMs: STORED_AT_MS,
        expiresAtMs: STORED_AT_MS + EVENT_TTL_MS,
      },
    ]);
  });

  it("除外ラベルが付いたままの別ラベル付け外しは skipped になる", ({ unrelatedLabelResponse }) => {
    expect(unrelatedLabelResponse).toStrictEqual({
      status: 200,
      body: { skipped: true, reason: "excluded by label" },
    });
  });

  it("除外ラベルが付いたままの別ラベル付け外しは保存されない", ({
    eventsStoredForUnrelatedLabel,
  }) => {
    expect(eventsStoredForUnrelatedLabel).toStrictEqual([]);
  });

  it("除外ラベル付き PR の pull_request_review も保存されない", ({ excludedReviewResponse }) => {
    expect(excludedReviewResponse).toStrictEqual({
      status: 200,
      body: { skipped: true, reason: "excluded by label" },
    });
  });

  it("check_suite は除外判定不能なので受理される", ({ checkSuiteResponse }) => {
    expect(checkSuiteResponse).toStrictEqual({ status: 200, body: { accepted: true } });
  });

  it("check_suite は除外判定不能なので常に保存される", ({ eventsStoredForCheckSuite }) => {
    expect(eventsStoredForCheckSuite).toStrictEqual([
      {
        id: "delivery-1",
        eventType: "check_suite",
        deliveryId: "delivery-1",
        payload: {
          action: "completed",
          check_suite: {
            conclusion: "failure",
            head_sha: "0a1b2c3",
            pull_requests: [{ number: 7 }],
          },
        },
        receivedAtMs: STORED_AT_MS,
        expiresAtMs: STORED_AT_MS + EVENT_TTL_MS,
      },
    ]);
  });
});

describe("close 時の後始末", () => {
  const it = test
    .extend("eventsAfterCloseDelivery", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const openedBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "opened",
        pull_request: { number: 7 },
      });
      await handleWebhook({
        rawBody: openedBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(openedBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      const closedBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "closed",
        pull_request: { number: 7 },
      });
      await handleWebhook({
        rawBody: closedBody,
        eventType: "pull_request",
        deliveryId: "delivery-2",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(closedBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readSince(0);
    })
    .extend("openedEventReadAfterCloseDelivery", async () => {
      const eventStore = createMemoryEventStore(() => STORED_AT_MS);
      const openedBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "opened",
        pull_request: { number: 7 },
      });
      await handleWebhook({
        rawBody: openedBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(openedBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      const closedBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "closed",
        pull_request: { number: 7 },
      });
      await handleWebhook({
        rawBody: closedBody,
        eventType: "pull_request",
        deliveryId: "delivery-2",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(closedBody).digest("hex")}`,
        config: webhookConfig,
        events: eventStore,
        log: silentLogger,
        stampedNow: () => STORED_AT_MS,
      });
      return eventStore.readAfterId("delivery-1");
    })
    .extend("closeDeliveryWithFailingDeletionResponse", () => {
      const failingDeletion: EventStore = {
        ...createMemoryEventStore(),
        deleteForPr: () => Promise.reject(new Error("batch delete failed")),
      };
      const requestBody = JSON.stringify({
        repository: { full_name: webhookConfig.githubRepository },
        action: "closed",
        pull_request: { number: 7 },
      });
      return handleWebhook({
        rawBody: requestBody,
        eventType: "pull_request",
        deliveryId: "delivery-1",
        signatureHeader: `sha256=${createHmac("sha256", webhookConfig.webhookSecret).update(requestBody).digest("hex")}`,
        config: webhookConfig,
        events: failingDeletion,
        log: silentLogger,
      });
    });

  it("close の後に残るのは close イベント自身だけになる", ({ eventsAfterCloseDelivery }) => {
    expect(eventsAfterCloseDelivery).toStrictEqual([
      {
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "closed", pull_request: { number: 7 } },
        receivedAtMs: STORED_AT_MS,
        expiresAtMs: STORED_AT_MS + EVENT_TTL_MS,
      },
    ]);
  });

  it("close 前に保存された同じ PR のイベントは読み出せなくなる", ({
    openedEventReadAfterCloseDelivery,
  }) => {
    expect(openedEventReadAfterCloseDelivery).toBe(null);
  });

  it("削除の失敗は warn のみで応答は 200 のまま", ({
    closeDeliveryWithFailingDeletionResponse,
  }) => {
    expect(closeDeliveryWithFailingDeletionResponse).toStrictEqual({
      status: 200,
      body: { accepted: true },
    });
  });
});
