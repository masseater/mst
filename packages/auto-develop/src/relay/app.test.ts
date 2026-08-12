import { createHmac } from "node:crypto";

import { describe, expect, test } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createRelayServer, type RelayServer } from "./app.ts";
import { GithubUnavailableError } from "./github-unavailable-error.ts";
import { IdTokenRejectionError } from "./id-token-rejection-error.ts";
import {
  createMemoryCursorStore,
  createMemoryEventStore,
  createMemorySessionStore,
} from "./memory-store.ts";
import { relayConfigFromEnv } from "./relay-config.ts";

import type { GithubPullSummary, GithubReader } from "./github-reader.ts";
import type { RelayDependencies } from "./routes.ts";

const openPull = (shape: Partial<GithubPullSummary> = {}): GithubPullSummary => ({
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
  requestedReviewerLogins: [],
  ...shape,
});

const stubGithub = (overrides: Partial<GithubReader> = {}): GithubReader => ({
  resolveTokenLogin: () => Promise.resolve("octocat"),
  readRepositoryPrivacy: () => Promise.resolve(true),
  listOpenPullRequests: () => Promise.resolve([]),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve([]),
  ...overrides,
});

const listeningRelay = async (
  overrides: Partial<RelayDependencies> = {},
): Promise<{ readonly origin: string; readonly relay: RelayServer }> => {
  const relay = createRelayServer({
    config: relayConfigFromEnv({
      GITHUB_REPOSITORY: "example-org/example-repo",
      GITHUB_WEBHOOK_SECRET: "shared-secret",
    }),
    events: createMemoryEventStore(),
    cursors: createMemoryCursorStore(),
    sessions: createMemorySessionStore(),
    github: stubGithub(),
    verifyIdToken: () => Promise.reject(new IdTokenRejectionError("not configured")),
    log: silentLogger,
    ...overrides,
  });
  await new Promise<void>((resolve) => {
    relay.server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });
  const address = relay.server.address();
  if (address === null || typeof address === "string") throw new Error("no listening address");
  return { origin: `http://127.0.0.1:${address.port}`, relay };
};

const decodeChunk = (writtenChunk: { readonly value?: unknown } | undefined): string =>
  new TextDecoder().decode(writtenChunk?.value as Uint8Array | undefined);

const signedWebhookBody = (carried: Readonly<Record<string, unknown>>) => {
  const requestBody = JSON.stringify(carried);
  return {
    requestBody,
    signature: `sha256=${createHmac("sha256", "shared-secret").update(requestBody).digest("hex")}`,
  };
};

const issuedToken = async (origin: string): Promise<string> => {
  const sessionResponse = await fetch(new URL("/auth/session", origin), {
    method: "POST",
    headers: { authorization: "Bearer github-token" },
  });
  const issued = (await sessionResponse.json()) as { readonly token: string };
  return issued.token;
};

const deliverOpenedWebhook = async (origin: string, deliveryId: string): Promise<number> => {
  const { requestBody, signature } = signedWebhookBody({
    repository: { full_name: "example-org/example-repo" },
    action: "opened",
    pull_request: { number: 7, user: { login: "octocat" } },
  });
  const webhookResponse = await fetch(new URL("/webhook", origin), {
    method: "POST",
    headers: {
      "x-github-event": "pull_request",
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": signature,
      "content-type": "application/json",
    },
    body: requestBody,
  });
  return webhookResponse.status;
};

const it = test
  .extend("healthCall", async () => {
    const { origin, relay } = await listeningRelay();
    const healthResponse = await fetch(new URL("/health", origin));
    const healthBody = await healthResponse.json();
    await relay.shutdown();
    return { status: healthResponse.status, body: healthBody };
  })
  .extend("missingRouteCall", async () => {
    const { origin, relay } = await listeningRelay();
    const missingResponse = await fetch(new URL("/missing", origin));
    const missingBody = await missingResponse.json();
    await relay.shutdown();
    return { status: missingResponse.status, body: missingBody };
  })
  .extend("authenticatedPoll", async () => {
    const { origin, relay } = await listeningRelay();
    const webhookStatus = await deliverOpenedWebhook(origin, "delivery-1");
    const connectionToken = await issuedToken(origin);
    const pollResponse = await fetch(new URL("/events/poll?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const pollBody = (await pollResponse.json()) as {
      readonly events: readonly { readonly delivery_id: string }[];
    };
    await relay.shutdown();
    return { webhookStatus, pollStatus: pollResponse.status, pollEvents: pollBody.events };
  })
  .extend("unauthenticatedPoll", async () => {
    const { origin, relay } = await listeningRelay();
    const pollResponse = await fetch(new URL("/events/poll?mode=author", origin));
    const pollBody = await pollResponse.json();
    await relay.shutdown();
    return { status: pollResponse.status, body: pollBody };
  })
  .extend("unknownModePoll", async () => {
    const { origin, relay } = await listeningRelay();
    const connectionToken = await issuedToken(origin);
    const pollResponse = await fetch(new URL("/events/poll?mode=observer", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const pollBody = await pollResponse.json();
    await relay.shutdown();
    return { status: pollResponse.status, body: pollBody };
  })
  .extend("githubDownSession", async () => {
    const { origin, relay } = await listeningRelay({
      github: stubGithub({
        resolveTokenLogin: () => Promise.reject(new GithubUnavailableError("rate limited")),
      }),
    });
    const sessionResponse = await fetch(new URL("/auth/session", origin), {
      method: "POST",
      headers: { authorization: "Bearer github-token" },
    });
    const sessionBody = await sessionResponse.json();
    await relay.shutdown();
    return { status: sessionResponse.status, body: sessionBody };
  })
  .extend("reviewerDrainEvents", async () => {
    const { origin, relay } = await listeningRelay({
      github: stubGithub({
        listOpenPullRequests: () =>
          Promise.resolve([openPull({ requestedReviewerLogins: ["octocat"] })]),
      }),
    });
    const connectionToken = await issuedToken(origin);
    const drainResponse = await fetch(new URL("/events/startup-drain?mode=reviewer", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const drainBody = (await drainResponse.json()) as {
      readonly events: readonly { readonly delivery_id: string }[];
    };
    await relay.shutdown();
    return drainBody.events;
  })
  .extend("deniedTask", async () => {
    const { origin, relay } = await listeningRelay();
    const checkResponse = await fetch(new URL("/tasks/check-base-updates", origin), {
      method: "POST",
      headers: { authorization: "Bearer signed-id-token" },
    });
    const checkBody = await checkResponse.json();
    await relay.shutdown();
    return { status: checkResponse.status, body: checkBody };
  })
  .extend("allowedSchedulerTask", async () => {
    const { origin, relay } = await listeningRelay({
      config: relayConfigFromEnv({
        GITHUB_REPOSITORY: "example-org/example-repo",
        GITHUB_WEBHOOK_SECRET: "shared-secret",
        SCHEDULER_SERVICE_ACCOUNT_EMAILS: "scheduler@example.test",
        RELAY_PUBLIC_ORIGIN: "https://relay.example.test",
      }),
      github: stubGithub({
        listOpenPullRequests: () => Promise.resolve([openPull({ mergeStateStatus: "BEHIND" })]),
      }),
      verifyIdToken: () =>
        Promise.resolve({ email: "scheduler@example.test", emailVerified: true }),
    });
    const checkResponse = await fetch(new URL("/tasks/check-base-updates", origin), {
      method: "POST",
      headers: { authorization: "Bearer signed-id-token" },
    });
    const checkBody = await checkResponse.json();
    await relay.shutdown();
    return { status: checkResponse.status, body: checkBody };
  })
  .extend("explodingDrain", async () => {
    const { origin, relay } = await listeningRelay({
      github: stubGithub({
        listOpenPullRequests: () => Promise.reject(new Error("github exploded")),
      }),
    });
    const connectionToken = await issuedToken(origin);
    const drainResponse = await fetch(new URL("/events/startup-drain?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const drainBody = await drainResponse.json();
    await relay.shutdown();
    return { status: drainResponse.status, body: drainBody };
  })
  .extend("anonymousDrainAndStream", async () => {
    const { origin, relay } = await listeningRelay();
    const drainResponse = await fetch(new URL("/events/startup-drain?mode=author", origin));
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin));
    await relay.shutdown();
    return { drainStatus: drainResponse.status, streamStatus: streamResponse.status };
  })
  .extend("keepaliveFrameText", async () => {
    const { origin, relay } = await listeningRelay({ now: Date.now, keepaliveMs: 5 });
    const connectionToken = await issuedToken(origin);
    const abort = new AbortController();
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
      signal: abort.signal,
    });
    const frameText = decodeChunk(await streamResponse.body?.getReader().read());
    abort.abort();
    await relay.shutdown();
    return frameText;
  })
  .extend("bareRequestStatus", async () => {
    const { relay } = await listeningRelay();
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");
    const bareRequest = new IncomingMessage(new Socket());
    const bareResponse = new ServerResponse(bareRequest);
    relay.server.emit("request", bareRequest, bareResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await relay.shutdown();
    return bareResponse.statusCode;
  })
  .extend("lateFailingStream", async () => {
    const { origin, relay } = await listeningRelay({
      cursors: {
        read: () => Promise.reject(new Error("cursor store exploded")),
        write: () => Promise.resolve(),
      },
    });
    const connectionToken = await issuedToken(origin);
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const finalChunk = await streamResponse.body?.getReader().read();
    await relay.shutdown();
    return { status: streamResponse.status, done: finalChunk?.done };
  })
  .extend("openStreamShutdown", async () => {
    const { origin, relay } = await listeningRelay();
    const connectionToken = await issuedToken(origin);
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const [settlement] = await Promise.allSettled([relay.shutdown()]);
    return { settlement, streamStatus: streamResponse.status };
  })
  .extend("backlogStreamFrame", async () => {
    const { origin, relay } = await listeningRelay();
    const webhookStatus = await deliverOpenedWebhook(origin, "delivery-1");
    const connectionToken = await issuedToken(origin);
    const abort = new AbortController();
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
      signal: abort.signal,
    });
    const frameText = decodeChunk(await streamResponse.body?.getReader().read());
    abort.abort();
    const contentType = streamResponse.headers.get("content-type");
    await relay.shutdown();
    return { webhookStatus, status: streamResponse.status, contentType, frameText };
  });

describe("relay サーバー", () => {
  it("health は 200 を返す", ({ healthCall }) => {
    expect(healthCall.status).toStrictEqual(200);
  });

  it("health は status ok を返す", ({ healthCall }) => {
    expect(healthCall.body).toStrictEqual({ status: "ok" });
  });

  it("未定義のルートは 404 を返す", ({ missingRouteCall }) => {
    expect(missingRouteCall.status).toStrictEqual(404);
  });

  it("未定義のルートは Not Found を返す", ({ missingRouteCall }) => {
    expect(missingRouteCall.body).toStrictEqual({ error: "Not Found" });
  });

  it("webhook 配送は 200 で受理される", ({ authenticatedPoll }) => {
    expect(authenticatedPoll.webhookStatus).toStrictEqual(200);
  });

  it("発行したトークンでの poll は 200 を返す", ({ authenticatedPoll }) => {
    expect(authenticatedPoll.pollStatus).toStrictEqual(200);
  });

  it("発行時の login から導出したカーソルで所有分が 1 件返る", ({ authenticatedPoll }) => {
    expect(authenticatedPoll.pollEvents.length).toStrictEqual(1);
  });

  it("発行したトークンで poll すると所有分が返る", ({ authenticatedPoll }) => {
    expect(authenticatedPoll.pollEvents[0]?.delivery_id).toStrictEqual("delivery-1");
  });

  it("接続クレデンシャルなしの poll は 401 を返す", ({ unauthenticatedPoll }) => {
    expect(unauthenticatedPoll.status).toStrictEqual(401);
  });

  it("接続クレデンシャルなしの poll は Unauthorized を返す", ({ unauthenticatedPoll }) => {
    expect(unauthenticatedPoll.body).toStrictEqual({ error: "Unauthorized" });
  });

  it("不正な mode は 400 を返す", ({ unknownModePoll }) => {
    expect(unknownModePoll.status).toStrictEqual(400);
  });

  it("不正な mode は理由つきで拒否される", ({ unknownModePoll }) => {
    expect(unknownModePoll.body).toStrictEqual({ error: "Invalid or missing mode" });
  });

  it("GitHub 到達不能のセッション発行は 503 を返す", ({ githubDownSession }) => {
    expect(githubDownSession.status).toStrictEqual(503);
  });

  it("GitHub 到達不能のセッション発行は Service Unavailable を返す", ({ githubDownSession }) => {
    expect(githubDownSession.body).toStrictEqual({ error: "Service Unavailable" });
  });

  it("startup drain は認証 operator の未処理作業を 1 件返す", ({ reviewerDrainEvents }) => {
    expect(reviewerDrainEvents.length).toStrictEqual(1);
  });

  it("startup drain は認証 operator の未処理作業を返す", ({ reviewerDrainEvents }) => {
    expect(reviewerDrainEvents[0]?.delivery_id).toStrictEqual(
      "startup-drain:pull_request:7:head-sha:review-requested",
    );
  });

  it("スケジューラ許可リストが空なら check-base-updates は 401 で閉じる", ({ deniedTask }) => {
    expect(deniedTask.status).toStrictEqual(401);
  });

  it("スケジューラ許可リストが空なら check-base-updates は Unauthorized を返す", ({
    deniedTask,
  }) => {
    expect(deniedTask.body).toStrictEqual({ error: "Unauthorized" });
  });

  it("許可された scheduler の check-base-updates は 200 になる", ({ allowedSchedulerTask }) => {
    expect(allowedSchedulerTask.status).toStrictEqual(200);
  });

  it("許可された scheduler は base 遅れを保存して件数を返す", ({ allowedSchedulerTask }) => {
    expect(allowedSchedulerTask.body).toStrictEqual({ scanned: 1, behind: 1, stored: 1 });
  });

  it("未分類のルート失敗は 500 になる", ({ explodingDrain }) => {
    expect(explodingDrain.status).toStrictEqual(500);
  });

  it("未分類のルート失敗は 500 の JSON になる", ({ explodingDrain }) => {
    expect(explodingDrain.body).toStrictEqual({ error: "Internal Server Error" });
  });

  it("クレデンシャルなしの startup drain は 401 で閉じる", ({ anonymousDrainAndStream }) => {
    expect(anonymousDrainAndStream.drainStatus).toStrictEqual(401);
  });

  it("クレデンシャルなしの stream は 401 で閉じる", ({ anonymousDrainAndStream }) => {
    expect(anonymousDrainAndStream.streamStatus).toStrictEqual(401);
  });

  it("keepalive は ping の空データフレームとして届く", ({ keepaliveFrameText }) => {
    expect(keepaliveFrameText).toStrictEqual("event: ping\ndata:\n\n");
  });

  it("メソッドと URL の欠けたリクエストは GET / として 404 になる", ({ bareRequestStatus }) => {
    expect(bareRequestStatus).toStrictEqual(404);
  });

  it("ヘッダ送信後の失敗でも応答は 200 で始まっている", ({ lateFailingStream }) => {
    expect(lateFailingStream.status).toStrictEqual(200);
  });

  it("ヘッダ送信後の失敗は応答を閉じて終える", ({ lateFailingStream }) => {
    expect(lateFailingStream.done).toStrictEqual(true);
  });

  it("ドレイン予算を超えた SSE 接続があっても shutdown が完了する", ({ openStreamShutdown }) => {
    expect(openStreamShutdown.settlement).toStrictEqual({ status: "fulfilled", value: undefined });
  });

  it("ドレイン予算を超えた SSE 接続は強制切断される", ({ openStreamShutdown }) => {
    expect(openStreamShutdown.streamStatus).toStrictEqual(200);
  });

  it("バックログ配信前の webhook は 200 で受理される", ({ backlogStreamFrame }) => {
    expect(backlogStreamFrame.webhookStatus).toStrictEqual(200);
  });

  it("SSE ストリームは 200 で始まる", ({ backlogStreamFrame }) => {
    expect(backlogStreamFrame.status).toStrictEqual(200);
  });

  it("SSE ストリームは text/event-stream を名乗る", ({ backlogStreamFrame }) => {
    expect(backlogStreamFrame.contentType).toStrictEqual("text/event-stream");
  });

  it("SSE フレームは契約どおりの event と data で始まる", ({ backlogStreamFrame }) => {
    expect(backlogStreamFrame.frameText).toMatch(/^event: pull_request\ndata: /);
  });

  it("SSE フレームは契約どおりの id で終わる", ({ backlogStreamFrame }) => {
    expect(backlogStreamFrame.frameText).toMatch(/id: delivery-1\n\n$/);
  });
});
