import { describe, expect, test, vi } from "vite-plus/test";

import { CredentialTerminalError } from "./credential-provider.ts";
import { SseRequestRejectedError } from "./sse-request-rejected-error.ts";
import { createSseTransport } from "./sse-transport.ts";

const STREAM_URL = "http://relay.internal/events/stream";
const TOKEN = "Bearer connection-credential";
const RELAY = { url: STREAM_URL, mode: "author", reconnectOnClose: false } as const;
const RECONNECTING_RELAY = { ...RELAY, reconnectOnClose: true };
const SENT_HEADERS = { accept: "text/event-stream", authorization: TOKEN };
const RESUMED_HEADERS = { ...SENT_HEADERS, "last-event-id": "evt-1" };
const FIRST_FRAME = `id: evt-1\ndata: {"schema_version":1,"event_type":"pull_request","delivery_id":"evt-1","payload":{"number":7}}\n\n`;
const RESENT_FRAME = `id: evt-1\ndata: {"schema_version":1,"event_type":"pull_request","delivery_id":"evt-1","payload":{"number":8}}\n\n`;
const SECOND_FRAME = `id: evt-2\ndata: {"schema_version":1,"event_type":"pull_request","delivery_id":"evt-2","payload":{"number":7}}\n\n`;
const THIRD_FRAME = `id: evt-3\ndata: {"schema_version":1,"event_type":"pull_request","delivery_id":"evt-3","payload":{"number":3}}\n\n`;
const BROKEN_FRAME = "id: evt-broken\ndata: not-json\n\n";
const ANONYMOUS_FRAME = "data: also-broken\n\n";
const PING_FRAME = "event: ping\ndata:\n\n";
const BROKEN_BODY = BROKEN_FRAME + ANONYMOUS_FRAME + SECOND_FRAME;
const EVICTING_BODY = FIRST_FRAME + SECOND_FRAME + THIRD_FRAME + FIRST_FRAME;
const FIRST_EVENT = { number: 7, event_type: "pull_request", delivery_id: "evt-1" };
const SECOND_EVENT = { number: 7, event_type: "pull_request", delivery_id: "evt-2" };
const THIRD_EVENT = { number: 3, event_type: "pull_request", delivery_id: "evt-3" };
const GONE_CREDENTIAL = "credential source is gone";
const PARSE_FAILURE_PREFIX = "[sse-transport] Failed to parse or validate frame payload";
const IDENTIFIED_FAILURE_LOG = `${PARSE_FAILURE_PREFIX} (frameId=evt-broken): SyntaxError: Unexpected token 'o', "not-json" is not valid JSON\n`;
const ANONYMOUS_FAILURE_LOG = `${PARSE_FAILURE_PREFIX} (frameId=none): SyntaxError: Unexpected token 'a', "also-broken" is not valid JSON\n`;
const SERVER_FAILURE_TEXT = "Error: SSE connect failed: 500";
const DEADLINE_EXCEEDED_TEXT = "Error: SSE retry deadline exceeded";
const BROKEN_TIMER_TEXT = "Error: timer broke";
const FIRST_BACKOFF_LOG = `[sse-transport] Connection attempt 1 failed, backing off 1000ms: ${SERVER_FAILURE_TEXT}\n`;
const SECOND_BACKOFF_LOG = `[sse-transport] Connection attempt 2 failed, backing off 2000ms: ${SERVER_FAILURE_TEXT}\n`;
const THIRD_BACKOFF_LOG = `[sse-transport] Connection attempt 3 failed, backing off 4000ms: ${SERVER_FAILURE_TEXT}\n`;
const FOURTH_BACKOFF_LOG = `[sse-transport] Connection attempt 4 failed, backing off 8000ms: ${SERVER_FAILURE_TEXT}\n`;
const FIFTH_BACKOFF_LOG = `[sse-transport] Connection attempt 5 failed, backing off 16000ms: ${SERVER_FAILURE_TEXT}\n`;
const SIXTH_BACKOFF_LOG = `[sse-transport] Connection attempt 6 failed, backing off 29000ms: ${SERVER_FAILURE_TEXT}\n`;
const SERVER_CLOSED_LOG = `[sse-transport] Connection attempt 1 failed, backing off 1000ms: Error: SSE connection closed by server\n`;
const REQUEST_REJECTED_SETTLEMENT = { status: "rejected", reason: new SseRequestRejectedError() };
const GONE_REASON = new CredentialTerminalError(GONE_CREDENTIAL);
const CREDENTIAL_GONE_SETTLEMENT = { status: "rejected", reason: GONE_REASON };
const QUIET_SETTLEMENT = { status: "fulfilled", value: undefined };
const EXHAUSTED_STEP = { done: true, value: undefined };
const REJECTED_PROPERTY_NAMES = ["name", "code", "category"];

describe("接続リクエストの形", () => {
  const it = test
    .extend("openingHeaders", async () => {
      const sentHeaders = vi.fn<(headers: unknown) => void>();
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl: typeof fetch = async (_url, init) => {
        sentHeaders(init?.headers);
        return new Response(FIRST_FRAME);
      };
      await createSseTransport({ ...RELAY, credentials, fetchImpl }).connect();
      return sentHeaders;
    })
    .extend("deliveredEvents", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(FIRST_FRAME));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      const connecting = sse.connect();
      const consuming = Array.fromAsync(sse.events());
      await connecting;
      return consuming;
    })
    .extend("resumedHeaders", async () => {
      const sentHeaders = vi.fn<(headers: unknown) => void>();
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl: typeof fetch = async (_url, init) => {
        sentHeaders(init?.headers);
        if (sentHeaders.mock.calls.length === 1) return new Response(FIRST_FRAME);
        sse.disconnect();
        return new Response("");
      };
      const wiring = { ...RECONNECTING_RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      await sse.connect();
      return sentHeaders;
    });

  it("認可ヘッダは提供者の値がそのまま入る", ({ openingHeaders }) => {
    expect(openingHeaders).toHaveBeenCalledWith(SENT_HEADERS);
  });

  it("受け取ったフレームは配送される", ({ deliveredEvents }) => {
    expect(deliveredEvents).toStrictEqual([FIRST_EVENT]);
  });

  it("配信済み id を持って再接続すると Last-Event-ID が付く", ({ resumedHeaders }) => {
    expect(resumedHeaders).toHaveBeenCalledWith(RESUMED_HEADERS);
  });
});

describe("フレーム処理", () => {
  const it = test
    .extend("repeatedIdEvents", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(FIRST_FRAME + RESENT_FRAME));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      const connecting = sse.connect();
      const consuming = Array.fromAsync(sse.events());
      await connecting;
      return consuming;
    })
    .extend("brokenJsonEvents", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(BROKEN_BODY));
      const sse = createSseTransport({ ...RELAY, credentials, diagnostics, fetchImpl });
      const connecting = sse.connect();
      const consuming = Array.fromAsync(sse.events());
      await connecting;
      return consuming;
    })
    .extend("brokenFrameLog", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const writes = vi.fn<(chunk: string) => void>();
      const diagnostics = { write: writes };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(BROKEN_BODY));
      const sse = createSseTransport({ ...RELAY, credentials, diagnostics, fetchImpl });
      await sse.connect();
      return writes;
    })
    .extend("pingSkippingEvents", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(PING_FRAME + FIRST_FRAME));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      const connecting = sse.connect();
      const consuming = Array.fromAsync(sse.events());
      await connecting;
      return consuming;
    })
    .extend("evictedIdEvents", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(EVICTING_BODY));
      const wiring = { ...RELAY, credentials, fetchImpl, knownIdLimit: 2 };
      const sse = createSseTransport(wiring);
      const connecting = sse.connect();
      const consuming = Array.fromAsync(sse.events());
      await connecting;
      return consuming;
    })
    .extend("splitChunkEvents", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const encoder = new TextEncoder();
      const split = [FIRST_FRAME.slice(0, 10), FIRST_FRAME.slice(10)];
      const splitStream = ReadableStream.from(split.map((piece) => encoder.encode(piece)));
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(splitStream));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      const connecting = sse.connect();
      const consuming = Array.fromAsync(sse.events());
      await connecting;
      return consuming;
    });

  it("同じ id のフレームは二度処理されない", ({ repeatedIdEvents }) => {
    expect(repeatedIdEvents).toStrictEqual([FIRST_EVENT]);
  });

  it("不正な JSON のフレームは捨てられ後続は配送される", ({ brokenJsonEvents }) => {
    expect(brokenJsonEvents).toStrictEqual([SECOND_EVENT]);
  });

  it("id を持つ不正フレームは frameId 付きで診断ログに出る", ({ brokenFrameLog }) => {
    expect(brokenFrameLog).toHaveBeenCalledWith(IDENTIFIED_FAILURE_LOG);
  });

  it("id の無い不正フレームは frameId=none で診断ログに出る", ({ brokenFrameLog }) => {
    expect(brokenFrameLog).toHaveBeenCalledWith(ANONYMOUS_FAILURE_LOG);
  });

  it("ping フレームは配送前に破棄される", ({ pingSkippingEvents }) => {
    expect(pingSkippingEvents).toStrictEqual([FIRST_EVENT]);
  });

  it("既知 id が上限で溢れたら最古が追い出され再送も配送される", ({ evictedIdEvents }) => {
    expect(evictedIdEvents).toStrictEqual([FIRST_EVENT, SECOND_EVENT, THIRD_EVENT, FIRST_EVENT]);
  });

  it("チャンク境界で割れたフレームは組み立てられる", ({ splitChunkEvents }) => {
    expect(splitChunkEvents).toStrictEqual([FIRST_EVENT]);
  });
});

describe("接続失敗の分類", () => {
  const it = test
    .extend("unauthorizedFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const wiring = { ...RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 401 }));
      await sse.connect();
      return fetchImpl;
    })
    .extend("unauthorizedInvalidations", async () => {
      const invalidate = vi.fn<() => void>();
      const credentials = { authorizationFor: async () => TOKEN, invalidate };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const wiring = { ...RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 401 }));
      await sse.connect();
      return invalidate;
    })
    .extend("forbiddenFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const wiring = { ...RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 403 }));
      await sse.connect();
      return fetchImpl;
    })
    .extend("forbiddenInvalidations", async () => {
      const invalidate = vi.fn<() => void>();
      const credentials = { authorizationFor: async () => TOKEN, invalidate };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const wiring = { ...RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 403 }));
      await sse.connect();
      return invalidate;
    })
    .extend("retriedStatusFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const wiring = { ...RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 408 }));
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 429 }));
      await sse.connect();
      return fetchImpl;
    })
    .extend("notFoundSettlements", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      return Promise.allSettled([sse.connect()]);
    })
    .extend("notFoundRejectionKeys", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      const settlements = await Promise.allSettled([sse.connect()]);
      return settlements.flatMap((settled) =>
        settled.status === "rejected" ? Object.keys(settled.reason as object) : [],
      );
    })
    .extend("notFoundFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      await Promise.allSettled([sse.connect()]);
      return fetchImpl;
    })
    .extend("notFoundConsumerStep", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      await Promise.allSettled([sse.connect()]);
      return sse.events().next();
    })
    .extend("credentialGoneSettlements", async () => {
      const authorizationFor = () => Promise.reject(new CredentialTerminalError(GONE_CREDENTIAL));
      const credentials = { authorizationFor, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      return Promise.allSettled([sse.connect()]);
    })
    .extend("credentialGoneFetches", async () => {
      const authorizationFor = () => Promise.reject(new CredentialTerminalError(GONE_CREDENTIAL));
      const credentials = { authorizationFor, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      await Promise.allSettled([sse.connect()]);
      return fetchImpl;
    })
    .extend("abortedFetchLog", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const writes = vi.fn<(chunk: string) => void>();
      const diagnostics = { write: writes };
      const fetchImpl = vi.fn<typeof fetch>((_url, init) => {
        const pending = new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
        sse.disconnect();
        return pending;
      });
      const sse = createSseTransport({ ...RELAY, credentials, diagnostics, fetchImpl });
      await sse.connect();
      return writes;
    });

  it("401 はバックオフ再接続する", ({ unauthorizedFetches }) => {
    expect(unauthorizedFetches).toHaveBeenCalledTimes(2);
  });

  it("401 は invalidate を 1 回だけ呼ぶ", ({ unauthorizedInvalidations }) => {
    expect(unauthorizedInvalidations).toHaveBeenCalledTimes(1);
  });

  it("403 はバックオフ再接続する", ({ forbiddenFetches }) => {
    expect(forbiddenFetches).toHaveBeenCalledTimes(2);
  });

  it("403 は invalidate を 1 回だけ呼ぶ", ({ forbiddenInvalidations }) => {
    expect(forbiddenInvalidations).toHaveBeenCalledTimes(1);
  });

  it("408 と 429 はバックオフ再接続する", ({ retriedStatusFetches }) => {
    expect(retriedStatusFetches).toHaveBeenCalledTimes(3);
  });

  it("その他の 4xx は専用の致命エラーで拒否する", ({ notFoundSettlements }) => {
    expect(notFoundSettlements).toStrictEqual([REQUEST_REJECTED_SETTLEMENT]);
  });

  it("その他の 4xx の致命エラーは heldStatus を持たない", ({ notFoundRejectionKeys }) => {
    expect(notFoundRejectionKeys).toStrictEqual(REJECTED_PROPERTY_NAMES);
  });

  it("その他の 4xx は一度も再試行しない", ({ notFoundFetches }) => {
    expect(notFoundFetches).toHaveBeenCalledTimes(1);
  });

  it("その他の 4xx では消費側が即終端する", ({ notFoundConsumerStep }) => {
    expect(notFoundConsumerStep).toStrictEqual(EXHAUSTED_STEP);
  });

  it("資格情報が根本的に取得できなければ停止する", ({ credentialGoneSettlements }) => {
    expect(credentialGoneSettlements).toStrictEqual([CREDENTIAL_GONE_SETTLEMENT]);
  });

  it("資格情報が根本的に取得できなければ fetch を送らない", ({ credentialGoneFetches }) => {
    expect(credentialGoneFetches).toHaveBeenCalledTimes(0);
  });

  it("disconnect 起因の中断は正常終了でログも出ない", ({ abortedFetchLog }) => {
    expect(abortedFetchLog).toHaveBeenCalledTimes(0);
  });
});

describe("再試行打ち切り", () => {
  const it = test
    .extend("exhaustedRetryFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = vi.fn<(delayMs: number) => Promise<void>>(async () => undefined);
      const nowMs = () => sleep.mock.calls.reduce((elapsedMs, [delayMs]) => elapsedMs + delayMs, 0);
      const random = () => 0.5;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
      const wiring = { ...RELAY, credentials, sleep, now: nowMs, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      await Promise.allSettled([sse.connect()]);
      return fetchImpl;
    })
    .extend("exhaustedRetryLog", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = vi.fn<(delayMs: number) => Promise<void>>(async () => undefined);
      const nowMs = () => sleep.mock.calls.reduce((elapsedMs, [delayMs]) => elapsedMs + delayMs, 0);
      const random = () => 0.5;
      const writes = vi.fn<(chunk: string) => void>();
      const diagnostics = { write: writes };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
      const wiring = { ...RELAY, credentials, sleep, now: nowMs, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      await Promise.allSettled([sse.connect()]);
      return writes;
    })
    .extend("exhaustedRetryRejections", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = vi.fn<(delayMs: number) => Promise<void>>(async () => undefined);
      const nowMs = () => sleep.mock.calls.reduce((elapsedMs, [delayMs]) => elapsedMs + delayMs, 0);
      const random = () => 0.5;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
      const wiring = { ...RELAY, credentials, sleep, now: nowMs, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      const settlements = await Promise.allSettled([sse.connect()]);
      return settlements.flatMap((settled) =>
        settled.status === "rejected" ? [String(settled.reason)] : [],
      );
    })
    .extend("endlessRetryFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = vi.fn<(delayMs: number) => Promise<void>>(async () => undefined);
      const nowMs = () => sleep.mock.calls.reduce((elapsedMs, [delayMs]) => elapsedMs + delayMs, 0);
      const random = () => 0.5;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        sleep.mock.calls.length > 5 ? new Response("") : new Response(null, { status: 500 }),
      );
      const relay = { ...RELAY, retryDeadlineMs: Number.POSITIVE_INFINITY };
      const wiring = { ...relay, credentials, sleep, now: nowMs, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      await sse.connect();
      return fetchImpl;
    })
    .extend("stalledFetchRejections", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      );
      const relay = { ...RELAY, retryDeadlineMs: 50 };
      const wiring = { ...relay, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      const settlements = await Promise.allSettled([sse.connect()]);
      return settlements.flatMap((settled) =>
        settled.status === "rejected" ? [String(settled.reason)] : [],
      );
    });

  it("60 秒窓では 7 回試行して打ち切る", ({ exhaustedRetryFetches }) => {
    expect(exhaustedRetryFetches).toHaveBeenCalledTimes(7);
  });

  it("1 回目の失敗は 1000ms のバックオフを記録する", ({ exhaustedRetryLog }) => {
    expect(exhaustedRetryLog).toHaveBeenCalledWith(FIRST_BACKOFF_LOG);
  });

  it("2 回目の失敗は 2000ms のバックオフを記録する", ({ exhaustedRetryLog }) => {
    expect(exhaustedRetryLog).toHaveBeenCalledWith(SECOND_BACKOFF_LOG);
  });

  it("3 回目の失敗は 4000ms のバックオフを記録する", ({ exhaustedRetryLog }) => {
    expect(exhaustedRetryLog).toHaveBeenCalledWith(THIRD_BACKOFF_LOG);
  });

  it("4 回目の失敗は 8000ms のバックオフを記録する", ({ exhaustedRetryLog }) => {
    expect(exhaustedRetryLog).toHaveBeenCalledWith(FOURTH_BACKOFF_LOG);
  });

  it("5 回目の失敗は 16000ms のバックオフを記録する", ({ exhaustedRetryLog }) => {
    expect(exhaustedRetryLog).toHaveBeenCalledWith(FIFTH_BACKOFF_LOG);
  });

  it("6 回目の失敗は窓の残りの 29000ms を記録する", ({ exhaustedRetryLog }) => {
    expect(exhaustedRetryLog).toHaveBeenCalledWith(SIXTH_BACKOFF_LOG);
  });

  it("打ち切りは最後の失敗のまま拒否する", ({ exhaustedRetryRejections }) => {
    expect(exhaustedRetryRejections).toStrictEqual([SERVER_FAILURE_TEXT]);
  });

  it("打ち切り Infinity なら窓を超えても再試行を続ける", ({ endlessRetryFetches }) => {
    expect(endlessRetryFetches).toHaveBeenCalledTimes(7);
  });

  it("応答しない fetch は窓のデッドラインで包み直して拒否する", ({ stalledFetchRejections }) => {
    expect(stalledFetchRejections).toStrictEqual([DEADLINE_EXCEEDED_TEXT]);
  });
});

describe("サーバー側クローズと読み取りタイムアウト", () => {
  const it = test
    .extend("serverClosedFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        sse.disconnect();
        return new Response("");
      });
      const wiring = { ...RECONNECTING_RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(""));
      await sse.connect();
      return fetchImpl;
    })
    .extend("serverClosedLog", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const random = () => 0.5;
      const writes = vi.fn<(chunk: string) => void>();
      const diagnostics = { write: writes };
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        sse.disconnect();
        return new Response("");
      });
      const wiring = { ...RECONNECTING_RELAY, credentials, sleep, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(""));
      await sse.connect();
      return writes;
    })
    .extend("readTimeoutFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = async () => undefined;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        sse.disconnect();
        return new Response("");
      });
      const relay = { ...RECONNECTING_RELAY, readTimeoutMs: 10 };
      const wiring = { ...relay, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      const stalled = new Response(new ReadableStream<Uint8Array>({ start: () => undefined }));
      fetchImpl.mockResolvedValueOnce(stalled);
      await sse.connect();
      return fetchImpl;
    })
    .extend("bodylessFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      await sse.connect();
      return fetchImpl;
    });

  it("再接続有効ならサーバー側クローズ後に再接続する", ({ serverClosedFetches }) => {
    expect(serverClosedFetches).toHaveBeenCalledTimes(2);
  });

  it("サーバー側クローズはバックオフのログに残る", ({ serverClosedLog }) => {
    expect(serverClosedLog).toHaveBeenCalledWith(SERVER_CLOSED_LOG);
  });

  it("バイトが来ないストリームは読み取りタイムアウトで切る", ({ readTimeoutFetches }) => {
    expect(readTimeoutFetches).toHaveBeenCalledTimes(2);
  });

  it("本文の無い応答はサーバー側クローズとして扱う", ({ bodylessFetches }) => {
    expect(bodylessFetches).toHaveBeenCalledTimes(1);
  });
});

describe("ライフサイクル", () => {
  const it = test
    .extend("reentrantFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(""));
      const sse = createSseTransport({ ...RELAY, credentials, fetchImpl });
      const connecting = sse.connect();
      await sse.connect();
      await connecting;
      return fetchImpl;
    })
    .extend("earlyDisconnectStep", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sse = createSseTransport({ ...RELAY, credentials });
      sse.disconnect();
      return sse.events().next();
    })
    .extend("realSleepFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const random = () => 0.5;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => {
        sse.disconnect();
        return new Response("");
      });
      const wiring = { ...RECONNECTING_RELAY, credentials, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      fetchImpl.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await sse.connect();
      return fetchImpl;
    })
    .extend("brokenSleepRejections", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const sleep = () => Promise.reject(new Error("timer broke"));
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
      const wiring = { ...RELAY, credentials, sleep, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      const settlements = await Promise.allSettled([sse.connect()]);
      return settlements.flatMap((settled) =>
        settled.status === "rejected" ? [String(settled.reason)] : [],
      );
    })
    .extend("interruptedSleepSettlements", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const random = () => 0.5;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
      const wiring = { ...RECONNECTING_RELAY, credentials, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      const connecting = Promise.allSettled([sse.connect()]);
      await new Promise((resolve) => setTimeout(resolve, 20));
      sse.disconnect();
      return connecting;
    })
    .extend("interruptedSleepFetches", async () => {
      const credentials = { authorizationFor: async () => TOKEN, invalidate: vi.fn<() => void>() };
      const random = () => 0.5;
      const diagnostics = { write: vi.fn<(chunk: string) => void>() };
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 500 }));
      const wiring = { ...RECONNECTING_RELAY, credentials, random, diagnostics, fetchImpl };
      const sse = createSseTransport(wiring);
      const connecting = Promise.allSettled([sse.connect()]);
      await new Promise((resolve) => setTimeout(resolve, 20));
      sse.disconnect();
      await connecting;
      return fetchImpl;
    });

  it("接続中の connect 再呼び出しは無操作になる", ({ reentrantFetches }) => {
    expect(reentrantFetches).toHaveBeenCalledTimes(1);
  });

  it("connect 前の disconnect で events は即終端する", ({ earlyDisconnectStep }) => {
    expect(earlyDisconnectStep).toStrictEqual(EXHAUSTED_STEP);
  });

  it("既定の sleep はバックオフ後に再試行し disconnect で中断できる", ({ realSleepFetches }) => {
    expect(realSleepFetches).toHaveBeenCalledTimes(2);
  });

  it("バックオフ sleep 自体の失敗は connect の拒否になる", ({ brokenSleepRejections }) => {
    expect(brokenSleepRejections).toStrictEqual([BROKEN_TIMER_TEXT]);
  });

  it("既定 sleep 中の disconnect は中断として正常終了する", ({ interruptedSleepSettlements }) => {
    expect(interruptedSleepSettlements).toStrictEqual([QUIET_SETTLEMENT]);
  });

  it("既定 sleep 中の disconnect 後は再試行しない", ({ interruptedSleepFetches }) => {
    expect(interruptedSleepFetches).toHaveBeenCalledTimes(1);
  });
});
