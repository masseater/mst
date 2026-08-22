import { createHmac } from "node:crypto";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createRelayServer } from "./app.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";
import { IdTokenRejectionError } from "./id-token-rejection-error.ts";
import { createMemoryCursorStore } from "./memory-cursor-store.ts";
import { createMemoryEventStore } from "./memory-event-store.ts";
import { createMemorySessionStore } from "./memory-session-store.ts";
import { relayConfigFromEnv } from "./relay-config.ts";

const RELAY_ENVIRONMENT = {
  GITHUB_REPOSITORY: "example-org/example-repo",
  GITHUB_WEBHOOK_SECRET: "shared-secret",
};

const OPEN_PULL = {
  number: 7,
  title: "Add retry",
  draft: false,
  authorLogin: "octocat",
  baseSha: "base-sha",
  headSha: "head-sha",
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  reviewDecision: null,
  labelNames: [],
  requestedReviewerLogins: ["octocat"],
} as const;

describe("relay サーバー", () => {
  const relayTest = test
    .extend("startedRelay", async ({}, { onCleanup }) => {
      const relay = createRelayServer({
        config: relayConfigFromEnv(RELAY_ENVIRONMENT),
        events: createMemoryEventStore(),
        cursors: createMemoryCursorStore(),
        sessions: createMemorySessionStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        verifyIdToken: () => Promise.reject(new IdTokenRejectionError("not configured")),
        log: silentLogger,
      });
      await new Promise<void>((resolve) => {
        relay.server.listen(0, "127.0.0.1", () => {
          resolve();
        });
      });
      onCleanup(() => relay.shutdown());
      return relay;
    })
    .extend("relayOrigin", ({ startedRelay }) => {
      const listeningAddress = startedRelay.server.address();
      if (listeningAddress === null || typeof listeningAddress === "string") {
        throw new Error("relay is not listening on a port");
      }
      const { port } = listeningAddress;
      return `http://127.0.0.1:${port}`;
    })
    .extend("connectionToken", async ({ relayOrigin }) => {
      const issuedSession = await fetch(new URL("/auth/session", relayOrigin), {
        method: "POST",
        headers: { authorization: "Bearer github-token" },
      });
      return (await issuedSession.json()) as { readonly token: string };
    });

  describe("health", () => {
    const it = relayTest
      .extend("healthStatus", async ({ relayOrigin }) => {
        const { status: healthStatus } = await fetch(new URL("/health", relayOrigin));
        return healthStatus;
      })
      .extend("healthBody", async ({ relayOrigin }) => {
        const healthResponse = await fetch(new URL("/health", relayOrigin));
        return healthResponse.json();
      });

    it("health は 200 を返す", ({ healthStatus }) => {
      expect(healthStatus).toBe(200);
    });

    it("health は status ok を返す", ({ healthBody }) => {
      expect(healthBody).toStrictEqual({ status: "ok" });
    });
  });

  describe("未定義のルート", () => {
    const it = relayTest
      .extend("missingRouteStatus", async ({ relayOrigin }) => {
        const { status: missingRouteStatus } = await fetch(new URL("/missing", relayOrigin));
        return missingRouteStatus;
      })
      .extend("missingRouteBody", async ({ relayOrigin }) => {
        const missingRouteResponse = await fetch(new URL("/missing", relayOrigin));
        return missingRouteResponse.json();
      });

    it("未定義のルートは 404 を返す", ({ missingRouteStatus }) => {
      expect(missingRouteStatus).toBe(404);
    });

    it("未定義のルートは Not Found を返す", ({ missingRouteBody }) => {
      expect(missingRouteBody).toStrictEqual({ error: "Not Found" });
    });
  });

  describe("配送済みの webhook", () => {
    const deliveredTest = relayTest.extend(
      "deliveredWebhookStatus",
      { auto: true },
      async ({ relayOrigin }) => {
        const carriedWebhook = JSON.stringify({
          repository: { full_name: "example-org/example-repo" },
          action: "opened",
          pull_request: { number: 7, user: { login: "octocat" } },
        });
        const { status: deliveredWebhookStatus } = await fetch(new URL("/webhook", relayOrigin), {
          method: "POST",
          headers: {
            "x-github-event": "pull_request",
            "x-github-delivery": "delivery-1",
            "x-hub-signature-256": `sha256=${createHmac("sha256", "shared-secret")
              .update(carriedWebhook)
              .digest("hex")}`,
            "content-type": "application/json",
          },
          body: carriedWebhook,
        });
        return deliveredWebhookStatus;
      },
    );

    describe("poll での取り出し", () => {
      const it = deliveredTest
        .extend("polledStatus", async ({ relayOrigin, connectionToken }) => {
          const { status: polledStatus } = await fetch(
            new URL("/events/poll?mode=author", relayOrigin),
            { headers: { authorization: `Bearer ${connectionToken.token}` } },
          );
          return polledStatus;
        })
        .extend("authorPolledBody", async ({ relayOrigin, connectionToken }) => {
          const polledResponse = await fetch(new URL("/events/poll?mode=author", relayOrigin), {
            headers: { authorization: `Bearer ${connectionToken.token}` },
          });
          return polledResponse.json();
        })
        .extend("repolledBody", async ({ relayOrigin, connectionToken }) => {
          await fetch(new URL("/events/poll?mode=author", relayOrigin), {
            headers: { authorization: `Bearer ${connectionToken.token}` },
          });
          const repolledResponse = await fetch(new URL("/events/poll?mode=author", relayOrigin), {
            headers: { authorization: `Bearer ${connectionToken.token}` },
          });
          return repolledResponse.json();
        });

      it("webhook 配送は 200 で受理される", ({ deliveredWebhookStatus }) => {
        expect(deliveredWebhookStatus).toBe(200);
      });

      it("発行したトークンでの poll は 200 を返す", ({ polledStatus }) => {
        expect(polledStatus).toBe(200);
      });

      it("発行時の login から導出したカーソルで所有分が返る", ({ authorPolledBody }) => {
        expect(authorPolledBody).toStrictEqual({
          events: [
            {
              schema_version: 1,
              event_type: "pull_request",
              delivery_id: "delivery-1",
              payload: {
                action: "opened",
                pull_request: { number: 7, user: { login: "octocat" } },
              },
            },
          ],
        });
      });

      it("一度返した配送は同じカーソルの poll では返らない", ({ repolledBody }) => {
        expect(repolledBody).toStrictEqual({ events: [] });
      });
    });

    describe("SSE でのバックログ配信", () => {
      const it = deliveredTest
        .extend("backlogStreamStatus", async ({ relayOrigin, connectionToken }) => {
          const streamHangup = new AbortController();
          const { status: backlogStreamStatus } = await fetch(
            new URL("/events/stream?mode=author", relayOrigin),
            {
              headers: { authorization: `Bearer ${connectionToken.token}` },
              signal: streamHangup.signal,
            },
          );
          streamHangup.abort();
          return backlogStreamStatus;
        })
        .extend("backlogContentType", async ({ relayOrigin, connectionToken }) => {
          const streamHangup = new AbortController();
          const streamResponse = await fetch(new URL("/events/stream?mode=author", relayOrigin), {
            headers: { authorization: `Bearer ${connectionToken.token}` },
            signal: streamHangup.signal,
          });
          streamHangup.abort();
          return streamResponse.headers.get("content-type");
        })
        .extend("backlogCacheControl", async ({ relayOrigin, connectionToken }) => {
          const streamHangup = new AbortController();
          const streamResponse = await fetch(new URL("/events/stream?mode=author", relayOrigin), {
            headers: { authorization: `Bearer ${connectionToken.token}` },
            signal: streamHangup.signal,
          });
          streamHangup.abort();
          return streamResponse.headers.get("cache-control");
        })
        .extend("backlogFrameText", async ({ relayOrigin, connectionToken }) => {
          const streamHangup = new AbortController();
          const streamResponse = await fetch(new URL("/events/stream?mode=author", relayOrigin), {
            headers: { authorization: `Bearer ${connectionToken.token}` },
            signal: streamHangup.signal,
          });
          const streamBody = streamResponse.body;
          if (streamBody === null) throw new Error("stream carries no body");
          const streamReader: ReadableStreamDefaultReader<Uint8Array> = streamBody.getReader();
          const { value: framePayload } = await streamReader.read();
          streamHangup.abort();
          return new TextDecoder().decode(framePayload);
        });

      it("バックログ配信前の webhook は 200 で受理される", ({ deliveredWebhookStatus }) => {
        expect(deliveredWebhookStatus).toBe(200);
      });

      it("SSE ストリームは 200 で始まる", ({ backlogStreamStatus }) => {
        expect(backlogStreamStatus).toBe(200);
      });

      it("SSE ストリームは text/event-stream を名乗る", ({ backlogContentType }) => {
        expect(backlogContentType).toBe("text/event-stream");
      });

      it("SSE ストリームは中継の保存を禁じる", ({ backlogCacheControl }) => {
        expect(backlogCacheControl).toBe("no-cache");
      });

      it("SSE フレームは契約どおりの event と data と id を運ぶ", ({ backlogFrameText }) => {
        expect(backlogFrameText).toBe(
          'event: pull_request\ndata: {"schema_version":1,"event_type":"pull_request","delivery_id":"delivery-1","payload":{"action":"opened","pull_request":{"number":7,"user":{"login":"octocat"}}}}\nid: delivery-1\n\n',
        );
      });
    });
  });

  describe("接続クレデンシャルのない poll", () => {
    const it = relayTest
      .extend("unauthenticatedPollStatus", async ({ relayOrigin }) => {
        const { status: unauthenticatedPollStatus } = await fetch(
          new URL("/events/poll?mode=author", relayOrigin),
        );
        return unauthenticatedPollStatus;
      })
      .extend("unauthenticatedPollBody", async ({ relayOrigin }) => {
        const polledResponse = await fetch(new URL("/events/poll?mode=author", relayOrigin));
        return polledResponse.json();
      });

    it("接続クレデンシャルなしの poll は 401 を返す", ({ unauthenticatedPollStatus }) => {
      expect(unauthenticatedPollStatus).toBe(401);
    });

    it("接続クレデンシャルなしの poll は Unauthorized を返す", ({ unauthenticatedPollBody }) => {
      expect(unauthenticatedPollBody).toStrictEqual({ error: "Unauthorized" });
    });
  });

  describe("不正な mode の poll", () => {
    const it = relayTest
      .extend("unknownModePollStatus", async ({ relayOrigin, connectionToken }) => {
        const { status: unknownModePollStatus } = await fetch(
          new URL("/events/poll?mode=observer", relayOrigin),
          { headers: { authorization: `Bearer ${connectionToken.token}` } },
        );
        return unknownModePollStatus;
      })
      .extend("unknownModePollBody", async ({ relayOrigin, connectionToken }) => {
        const polledResponse = await fetch(new URL("/events/poll?mode=observer", relayOrigin), {
          headers: { authorization: `Bearer ${connectionToken.token}` },
        });
        return polledResponse.json();
      });

    it("不正な mode は 400 を返す", ({ unknownModePollStatus }) => {
      expect(unknownModePollStatus).toBe(400);
    });

    it("不正な mode は理由つきで拒否される", ({ unknownModePollBody }) => {
      expect(unknownModePollBody).toStrictEqual({ error: "Invalid or missing mode" });
    });
  });

  describe("GitHub 到達不能", () => {
    const it = relayTest
      .extend("startedRelay", async ({}, { onCleanup }) => {
        const relay = createRelayServer({
          config: relayConfigFromEnv(RELAY_ENVIRONMENT),
          events: createMemoryEventStore(),
          cursors: createMemoryCursorStore(),
          sessions: createMemorySessionStore(),
          github: {
            resolveTokenLogin: () => Promise.reject(new GithubUnavailableError("rate limited")),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          verifyIdToken: () => Promise.reject(new IdTokenRejectionError("not configured")),
          log: silentLogger,
        });
        await new Promise<void>((resolve) => {
          relay.server.listen(0, "127.0.0.1", () => {
            resolve();
          });
        });
        onCleanup(() => relay.shutdown());
        return relay;
      })
      .extend("unavailableSessionStatus", async ({ relayOrigin }) => {
        const { status: unavailableSessionStatus } = await fetch(
          new URL("/auth/session", relayOrigin),
          { method: "POST", headers: { authorization: "Bearer github-token" } },
        );
        return unavailableSessionStatus;
      })
      .extend("unavailableSessionBody", async ({ relayOrigin }) => {
        const issuedSession = await fetch(new URL("/auth/session", relayOrigin), {
          method: "POST",
          headers: { authorization: "Bearer github-token" },
        });
        return issuedSession.json();
      });

    it("GitHub 到達不能のセッション発行は 503 を返す", ({ unavailableSessionStatus }) => {
      expect(unavailableSessionStatus).toBe(503);
    });

    it("GitHub 到達不能のセッション発行は Service Unavailable を返す", ({
      unavailableSessionBody,
    }) => {
      expect(unavailableSessionBody).toStrictEqual({ error: "Service Unavailable" });
    });
  });

  describe("レビュー待ちの startup drain", () => {
    const it = relayTest
      .extend("startedRelay", async ({}, { onCleanup }) => {
        const relay = createRelayServer({
          config: relayConfigFromEnv(RELAY_ENVIRONMENT),
          events: createMemoryEventStore(),
          cursors: createMemoryCursorStore(),
          sessions: createMemorySessionStore(),
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([OPEN_PULL]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          verifyIdToken: () => Promise.reject(new IdTokenRejectionError("not configured")),
          log: silentLogger,
        });
        await new Promise<void>((resolve) => {
          relay.server.listen(0, "127.0.0.1", () => {
            resolve();
          });
        });
        onCleanup(() => relay.shutdown());
        return relay;
      })
      .extend("reviewerDrainBody", async ({ relayOrigin, connectionToken }) => {
        const drainResponse = await fetch(
          new URL("/events/startup-drain?mode=reviewer", relayOrigin),
          { headers: { authorization: `Bearer ${connectionToken.token}` } },
        );
        return drainResponse.json();
      })
      .extend("authorDrainBody", async ({ relayOrigin, connectionToken }) => {
        const drainResponse = await fetch(
          new URL("/events/startup-drain?mode=author", relayOrigin),
          { headers: { authorization: `Bearer ${connectionToken.token}` } },
        );
        return drainResponse.json();
      });

    it("startup drain は認証 operator の未処理作業を返す", ({ reviewerDrainBody }) => {
      expect(reviewerDrainBody).toStrictEqual({
        events: [
          {
            schema_version: 1,
            event_type: "pull_request",
            delivery_id: "startup-drain:pull_request:7:head-sha:review-requested",
            payload: {
              action: "review_requested",
              pull_request: {
                number: 7,
                title: "Add retry",
                draft: false,
                user: { login: "octocat" },
              },
            },
          },
        ],
      });
    });

    it("startup drain は mode ごとに未処理作業を選び直す", ({ authorDrainBody }) => {
      expect(authorDrainBody).toStrictEqual({ events: [] });
    });
  });

  describe("スケジューラ許可リストが空の check-base-updates", () => {
    const it = relayTest
      .extend("deniedTaskStatus", async ({ relayOrigin }) => {
        const { status: deniedTaskStatus } = await fetch(
          new URL("/tasks/check-base-updates", relayOrigin),
          { method: "POST", headers: { authorization: "Bearer signed-id-token" } },
        );
        return deniedTaskStatus;
      })
      .extend("deniedTaskBody", async ({ relayOrigin }) => {
        const checkResponse = await fetch(new URL("/tasks/check-base-updates", relayOrigin), {
          method: "POST",
          headers: { authorization: "Bearer signed-id-token" },
        });
        return checkResponse.json();
      });

    it("スケジューラ許可リストが空なら check-base-updates は 401 で閉じる", ({
      deniedTaskStatus,
    }) => {
      expect(deniedTaskStatus).toBe(401);
    });

    it("スケジューラ許可リストが空なら check-base-updates は Unauthorized を返す", ({
      deniedTaskBody,
    }) => {
      expect(deniedTaskBody).toStrictEqual({ error: "Unauthorized" });
    });
  });

  describe("許可された scheduler の check-base-updates", () => {
    const it = relayTest
      .extend("startedRelay", async ({}, { onCleanup }) => {
        const relay = createRelayServer({
          config: relayConfigFromEnv({
            GITHUB_REPOSITORY: "example-org/example-repo",
            GITHUB_WEBHOOK_SECRET: "shared-secret",
            SCHEDULER_SERVICE_ACCOUNT_EMAILS: "scheduler@example.test",
            RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
          }),
          events: createMemoryEventStore(),
          cursors: createMemoryCursorStore(),
          sessions: createMemorySessionStore(),
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () =>
              Promise.resolve([{ ...OPEN_PULL, mergeStateStatus: "BEHIND" }]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          verifyIdToken: () =>
            Promise.resolve({ email: "scheduler@example.test", emailVerified: true }),
          log: silentLogger,
        });
        await new Promise<void>((resolve) => {
          relay.server.listen(0, "127.0.0.1", () => {
            resolve();
          });
        });
        onCleanup(() => relay.shutdown());
        return relay;
      })
      .extend("schedulerTaskStatus", async ({ relayOrigin }) => {
        const { status: schedulerTaskStatus } = await fetch(
          new URL("/tasks/check-base-updates", relayOrigin),
          { method: "POST", headers: { authorization: "Bearer signed-id-token" } },
        );
        return schedulerTaskStatus;
      })
      .extend("schedulerTaskBody", async ({ relayOrigin }) => {
        const checkResponse = await fetch(new URL("/tasks/check-base-updates", relayOrigin), {
          method: "POST",
          headers: { authorization: "Bearer signed-id-token" },
        });
        return checkResponse.json();
      });

    it("許可された scheduler の check-base-updates は 200 になる", ({ schedulerTaskStatus }) => {
      expect(schedulerTaskStatus).toBe(200);
    });

    it("許可された scheduler は base 遅れを保存して件数を返す", ({ schedulerTaskBody }) => {
      expect(schedulerTaskBody).toStrictEqual({ scanned: 1, behind: 1, stored: 1 });
    });
  });

  describe("未分類のルート失敗", () => {
    const it = relayTest
      .extend("startedRelay", async ({}, { onCleanup }) => {
        const relay = createRelayServer({
          config: relayConfigFromEnv(RELAY_ENVIRONMENT),
          events: createMemoryEventStore(),
          cursors: createMemoryCursorStore(),
          sessions: createMemorySessionStore(),
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.reject(new Error("github exploded")),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          verifyIdToken: () => Promise.reject(new IdTokenRejectionError("not configured")),
          log: silentLogger,
        });
        await new Promise<void>((resolve) => {
          relay.server.listen(0, "127.0.0.1", () => {
            resolve();
          });
        });
        onCleanup(() => relay.shutdown());
        return relay;
      })
      .extend("explodingDrainStatus", async ({ relayOrigin, connectionToken }) => {
        const { status: explodingDrainStatus } = await fetch(
          new URL("/events/startup-drain?mode=author", relayOrigin),
          { headers: { authorization: `Bearer ${connectionToken.token}` } },
        );
        return explodingDrainStatus;
      })
      .extend("explodingDrainBody", async ({ relayOrigin, connectionToken }) => {
        const drainResponse = await fetch(
          new URL("/events/startup-drain?mode=author", relayOrigin),
          { headers: { authorization: `Bearer ${connectionToken.token}` } },
        );
        return drainResponse.json();
      });

    it("未分類のルート失敗は 500 になる", ({ explodingDrainStatus }) => {
      expect(explodingDrainStatus).toBe(500);
    });

    it("未分類のルート失敗は 500 の JSON になる", ({ explodingDrainBody }) => {
      expect(explodingDrainBody).toStrictEqual({ error: "Internal Server Error" });
    });
  });

  describe("クレデンシャルのない購読", () => {
    const it = relayTest
      .extend("anonymousDrainStatus", async ({ relayOrigin }) => {
        const { status: anonymousDrainStatus } = await fetch(
          new URL("/events/startup-drain?mode=author", relayOrigin),
        );
        return anonymousDrainStatus;
      })
      .extend("anonymousStreamStatus", async ({ relayOrigin }) => {
        const { status: anonymousStreamStatus } = await fetch(
          new URL("/events/stream?mode=author", relayOrigin),
        );
        return anonymousStreamStatus;
      });

    it("クレデンシャルなしの startup drain は 401 で閉じる", ({ anonymousDrainStatus }) => {
      expect(anonymousDrainStatus).toBe(401);
    });

    it("クレデンシャルなしの stream は 401 で閉じる", ({ anonymousStreamStatus }) => {
      expect(anonymousStreamStatus).toBe(401);
    });
  });

  describe("keepalive", () => {
    const it = relayTest
      .extend("startedRelay", async ({}, { onCleanup }) => {
        const relay = createRelayServer({
          config: relayConfigFromEnv(RELAY_ENVIRONMENT),
          events: createMemoryEventStore(),
          cursors: createMemoryCursorStore(),
          sessions: createMemorySessionStore(),
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          verifyIdToken: () => Promise.reject(new IdTokenRejectionError("not configured")),
          log: silentLogger,
          now: Date.now,
          keepaliveMs: 5,
        });
        await new Promise<void>((resolve) => {
          relay.server.listen(0, "127.0.0.1", () => {
            resolve();
          });
        });
        onCleanup(() => relay.shutdown());
        return relay;
      })
      .extend("keepaliveFrameText", async ({ relayOrigin, connectionToken }) => {
        const streamHangup = new AbortController();
        const streamResponse = await fetch(new URL("/events/stream?mode=author", relayOrigin), {
          headers: { authorization: `Bearer ${connectionToken.token}` },
          signal: streamHangup.signal,
        });
        const streamBody = streamResponse.body;
        if (streamBody === null) throw new Error("stream carries no body");
        const streamReader: ReadableStreamDefaultReader<Uint8Array> = streamBody.getReader();
        const { value: framePayload } = await streamReader.read();
        streamHangup.abort();
        return new TextDecoder().decode(framePayload);
      });

    it("keepalive は ping の空データフレームとして届く", ({ keepaliveFrameText }) => {
      expect(keepaliveFrameText).toBe("event: ping\ndata:\n\n");
    });
  });

  describe("メソッドと URL の欠けたリクエスト", () => {
    const it = relayTest.extend("bareRequestWriteHead", async ({ startedRelay }) => {
      const bareRequest = new IncomingMessage(new Socket());
      const bareResponse = new ServerResponse(bareRequest);
      const writeHeadSpy = vi.spyOn(bareResponse, "writeHead");
      startedRelay.server.emit("request", bareRequest, bareResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return writeHeadSpy;
    });

    it("メソッドと URL の欠けたリクエストは GET / として 404 になる", ({
      bareRequestWriteHead,
    }) => {
      expect(bareRequestWriteHead).toHaveBeenCalledWith(404, {
        "content-type": "application/json",
      });
    });
  });

  describe("ヘッダ送信後に失敗する stream", () => {
    const it = relayTest
      .extend("startedRelay", async ({}, { onCleanup }) => {
        const relay = createRelayServer({
          config: relayConfigFromEnv(RELAY_ENVIRONMENT),
          events: createMemoryEventStore(),
          cursors: {
            read: () => Promise.reject(new Error("cursor store exploded")),
            write: () => Promise.resolve(),
          },
          sessions: createMemorySessionStore(),
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
          verifyIdToken: () => Promise.reject(new IdTokenRejectionError("not configured")),
          log: silentLogger,
        });
        await new Promise<void>((resolve) => {
          relay.server.listen(0, "127.0.0.1", () => {
            resolve();
          });
        });
        onCleanup(() => relay.shutdown());
        return relay;
      })
      .extend("lateFailingStreamStatus", async ({ relayOrigin, connectionToken }) => {
        const { status: lateFailingStreamStatus } = await fetch(
          new URL("/events/stream?mode=author", relayOrigin),
          { headers: { authorization: `Bearer ${connectionToken.token}` } },
        );
        return lateFailingStreamStatus;
      })
      .extend("lateFailingStreamDone", async ({ relayOrigin, connectionToken }) => {
        const streamResponse = await fetch(new URL("/events/stream?mode=author", relayOrigin), {
          headers: { authorization: `Bearer ${connectionToken.token}` },
        });
        const streamBody = streamResponse.body;
        if (streamBody === null) throw new Error("stream carries no body");
        const { done: lateFailingStreamDone } = await streamBody.getReader().read();
        return lateFailingStreamDone;
      });

    it("ヘッダ送信後の失敗でも応答は 200 で始まっている", ({ lateFailingStreamStatus }) => {
      expect(lateFailingStreamStatus).toBe(200);
    });

    it("ヘッダ送信後の失敗は応答を閉じて終える", ({ lateFailingStreamDone }) => {
      expect(lateFailingStreamDone).toBe(true);
    });
  });

  describe("開いた SSE 接続がある shutdown", () => {
    const it = relayTest
      .extend("shutdownSettlements", async ({ relayOrigin, connectionToken, startedRelay }) => {
        await fetch(new URL("/events/stream?mode=author", relayOrigin), {
          headers: { authorization: `Bearer ${connectionToken.token}` },
        });
        return Promise.allSettled([startedRelay.shutdown()]);
      })
      .extend("openStreamStatus", async ({ relayOrigin, connectionToken, startedRelay }) => {
        const { status: openStreamStatus } = await fetch(
          new URL("/events/stream?mode=author", relayOrigin),
          { headers: { authorization: `Bearer ${connectionToken.token}` } },
        );
        await startedRelay.shutdown();
        return openStreamStatus;
      });

    it("ドレイン予算を超えた SSE 接続があっても shutdown が完了する", ({ shutdownSettlements }) => {
      expect(shutdownSettlements).toStrictEqual([{ status: "fulfilled", value: undefined }]);
    });

    it("ドレイン予算を超えた SSE 接続は強制切断される", ({ openStreamStatus }) => {
      expect(openStreamStatus).toBe(200);
    });
  });
});
