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
import { relayConfigSchema } from "./relay-config.ts";

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
    config: relayConfigSchema.parse({
      githubRepository: "example-org/example-repo",
      webhookSecret: "shared-secret",
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

const decodeChunk = (chunk: { readonly value?: unknown } | undefined): string =>
  new TextDecoder().decode(chunk?.value as Uint8Array | undefined);

const signedWebhookBody = (payload: Readonly<Record<string, unknown>>) => {
  const rawBody = JSON.stringify(payload);
  return {
    rawBody,
    signature: `sha256=${createHmac("sha256", "shared-secret").update(rawBody).digest("hex")}`,
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
  const { rawBody, signature } = signedWebhookBody({
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
    body: rawBody,
  });
  return webhookResponse.status;
};

describe("relay サーバー", () => {
  test("health は status ok を返す", async () => {
    const { origin, relay } = await listeningRelay();
    const healthResponse = await fetch(new URL("/health", origin));
    expect([healthResponse.status, await healthResponse.json()]).toStrictEqual([
      200,
      { status: "ok" },
    ]);
    await relay.shutdown();
  });

  test("未定義のルートは 404 を返す", async () => {
    const { origin, relay } = await listeningRelay();
    const missingResponse = await fetch(new URL("/missing", origin));
    expect([missingResponse.status, await missingResponse.json()]).toStrictEqual([
      404,
      { error: "Not Found" },
    ]);
    await relay.shutdown();
  });

  test("発行したトークンで poll すると発行時の login から導出したカーソルで所有分が返る", async () => {
    const { origin, relay } = await listeningRelay();
    expect(await deliverOpenedWebhook(origin, "delivery-1")).toStrictEqual(200);
    const connectionToken = await issuedToken(origin);
    const pollResponse = await fetch(new URL("/events/poll?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const pollBody = (await pollResponse.json()) as {
      readonly events: readonly { readonly delivery_id: string }[];
    };
    expect([pollResponse.status, pollBody.events.map((event) => event.delivery_id)]).toStrictEqual([
      200,
      ["delivery-1"],
    ]);
    await relay.shutdown();
  });

  test("接続クレデンシャルなしの poll は 401 を返す", async () => {
    const { origin, relay } = await listeningRelay();
    const pollResponse = await fetch(new URL("/events/poll?mode=author", origin));
    expect([pollResponse.status, await pollResponse.json()]).toStrictEqual([
      401,
      { error: "Unauthorized" },
    ]);
    await relay.shutdown();
  });

  test("不正な mode は 400 を返す", async () => {
    const { origin, relay } = await listeningRelay();
    const connectionToken = await issuedToken(origin);
    const pollResponse = await fetch(new URL("/events/poll?mode=observer", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    expect([pollResponse.status, await pollResponse.json()]).toStrictEqual([
      400,
      { error: "Invalid or missing mode" },
    ]);
    await relay.shutdown();
  });

  test("GitHub 到達不能のセッション発行は 503 を返す", async () => {
    const { origin, relay } = await listeningRelay({
      github: stubGithub({
        resolveTokenLogin: () => Promise.reject(new GithubUnavailableError("rate limited")),
      }),
    });
    const sessionResponse = await fetch(new URL("/auth/session", origin), {
      method: "POST",
      headers: { authorization: "Bearer github-token" },
    });
    expect([sessionResponse.status, await sessionResponse.json()]).toStrictEqual([
      503,
      { error: "Service Unavailable" },
    ]);
    await relay.shutdown();
  });

  test("startup drain は認証 operator の未処理作業を返す", async () => {
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
    expect(drainBody.events.map((event) => event.delivery_id)).toStrictEqual([
      "startup-drain:pull_request:7:head-sha:review-requested",
    ]);
    await relay.shutdown();
  });

  test("スケジューラ許可リストが空なら check-base-updates は 401 で閉じる", async () => {
    const { origin, relay } = await listeningRelay();
    const checkResponse = await fetch(new URL("/tasks/check-base-updates", origin), {
      method: "POST",
      headers: { authorization: "Bearer signed-id-token" },
    });
    expect([checkResponse.status, await checkResponse.json()]).toStrictEqual([
      401,
      { error: "Unauthorized" },
    ]);
    await relay.shutdown();
  });

  test("許可された scheduler は base 遅れを保存して件数を返す", async () => {
    const { origin, relay } = await listeningRelay({
      config: relayConfigSchema.parse({
        githubRepository: "example-org/example-repo",
        webhookSecret: "shared-secret",
        schedulerServiceAccountEmails: ["scheduler@example.test"],
        publicOrigin: "https://relay.example.test",
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
    expect([checkResponse.status, await checkResponse.json()]).toStrictEqual([
      200,
      { scanned: 1, behind: 1, stored: 1 },
    ]);
    await relay.shutdown();
  });

  test("未分類のルート失敗は 500 の JSON になる", async () => {
    const { origin, relay } = await listeningRelay({
      github: stubGithub({
        listOpenPullRequests: () => Promise.reject(new Error("github exploded")),
      }),
    });
    const connectionToken = await issuedToken(origin);
    const drainResponse = await fetch(new URL("/events/startup-drain?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    expect([drainResponse.status, await drainResponse.json()]).toStrictEqual([
      500,
      { error: "Internal Server Error" },
    ]);
    await relay.shutdown();
  });

  test("クレデンシャルなしの startup drain と stream は 401 で閉じる", async () => {
    const { origin, relay } = await listeningRelay();
    const drainResponse = await fetch(new URL("/events/startup-drain?mode=author", origin));
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin));
    expect([drainResponse.status, streamResponse.status]).toStrictEqual([401, 401]);
    await relay.shutdown();
  });

  test("keepalive は ping の空データフレームとして届く", async () => {
    const { origin, relay } = await listeningRelay({ now: Date.now, keepaliveMs: 5 });
    const connectionToken = await issuedToken(origin);
    const abort = new AbortController();
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
      signal: abort.signal,
    });
    const frameReader = streamResponse.body?.getReader();
    const firstChunk = await frameReader?.read();
    const frameText = decodeChunk(firstChunk);
    abort.abort();
    expect(frameText).toStrictEqual("event: ping\ndata:\n\n");
    await relay.shutdown();
  });

  test("メソッドと URL の欠けたリクエストは GET / として 404 になる", async () => {
    const { relay } = await listeningRelay();
    const { IncomingMessage, ServerResponse } = await import("node:http");
    const { Socket } = await import("node:net");
    const bareRequest = new IncomingMessage(new Socket());
    const bareResponse = new ServerResponse(bareRequest);
    relay.server.emit("request", bareRequest, bareResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bareResponse.statusCode).toStrictEqual(404);
    await relay.shutdown();
  });

  test("ヘッダ送信後の失敗は応答を閉じて終える", async () => {
    const failingCursors = {
      read: () => Promise.reject(new Error("cursor store exploded")),
      write: () => Promise.resolve(),
    };
    const { origin, relay } = await listeningRelay({ cursors: failingCursors });
    const connectionToken = await issuedToken(origin);
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    const frameReader = streamResponse.body?.getReader();
    const finalChunk = await frameReader?.read();
    expect([streamResponse.status, finalChunk?.done]).toStrictEqual([200, true]);
    await relay.shutdown();
  });

  test("ドレイン予算を超えた SSE 接続は強制切断されて shutdown が完了する", async () => {
    const { origin, relay } = await listeningRelay();
    const connectionToken = await issuedToken(origin);
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
    });
    await expect(relay.shutdown()).resolves.toStrictEqual(undefined);
    expect(streamResponse.status).toStrictEqual(200);
  });

  test("SSE ストリームは契約どおりのフレームでバックログを配る", async () => {
    const { origin, relay } = await listeningRelay();
    expect(await deliverOpenedWebhook(origin, "delivery-1")).toStrictEqual(200);
    const connectionToken = await issuedToken(origin);
    const abort = new AbortController();
    const streamResponse = await fetch(new URL("/events/stream?mode=author", origin), {
      headers: { authorization: `Bearer ${connectionToken}` },
      signal: abort.signal,
    });
    const frameReader = streamResponse.body?.getReader();
    const firstChunk = await frameReader?.read();
    const frameText = decodeChunk(firstChunk);
    abort.abort();
    expect([
      streamResponse.status,
      streamResponse.headers.get("content-type"),
      frameText.startsWith("event: pull_request\ndata: "),
      frameText.endsWith("id: delivery-1\n\n"),
    ]).toStrictEqual([200, "text/event-stream", true, true]);
    await relay.shutdown();
  });
});
