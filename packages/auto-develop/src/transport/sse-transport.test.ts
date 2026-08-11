import { describe, expect, test, vi } from "vite-plus/test";

import { CredentialTerminalError, type CredentialProvider } from "./credential-provider.ts";
import { SseRequestRejectedError } from "./sse-request-rejected-error.ts";
import { createSseTransport, type SseTransportConfig } from "./sse-transport.ts";

const envelopeFrame = (frame: { readonly id?: string; readonly prNumber: number }): string => {
  const envelopeJson = JSON.stringify({
    schema_version: 1,
    event_type: "pull_request",
    delivery_id: frame.id ?? "delivery-x",
    payload: { action: "closed", pull_request: { number: frame.prNumber } },
  });
  return `${frame.id === undefined ? "" : `id: ${frame.id}\n`}data: ${envelopeJson}\n\n`;
};

const stubCredentials = (
  overrides: Partial<CredentialProvider> = {},
): CredentialProvider & { readonly invalidate: ReturnType<typeof vi.fn> } => {
  const invalidate = vi.fn<() => void>();
  return {
    authorizationFor: () => Promise.resolve("Bearer connection-credential"),
    ...overrides,
    invalidate,
  };
};

const capturingFetch = (
  outcomes: readonly ((init: RequestInit | undefined) => Response | Promise<Response>)[],
): { readonly fetchImpl: typeof fetch; readonly requests: () => readonly RequestInit[] } => {
  const calls = new Map<number, RequestInit | undefined>();
  const fetchImpl = ((_input: unknown, init?: RequestInit) => {
    const index = calls.size;
    calls.set(index, init);
    const plannedResponse = outcomes[Math.min(index, outcomes.length - 1)];
    if (plannedResponse === undefined) throw new Error("no outcome configured");
    return Promise.resolve(plannedResponse(init));
  }) as typeof fetch;
  return {
    fetchImpl,
    requests: () => [...calls.values()].map((init) => init ?? {}),
  };
};

const sseResponse = (body: string | null, status = 200): Response => new Response(body, { status });

const transportWith = (
  overrides: Partial<SseTransportConfig> & { readonly fetchImpl: typeof fetch },
) =>
  createSseTransport({
    url: "http://relay.internal/events/stream",
    credentials: stubCredentials(),
    mode: "author",
    reconnectOnClose: false,
    random: () => 0.5,
    sleep: () => Promise.resolve(),
    diagnostics: { write: vi.fn<(chunk: string) => void>() },
    ...overrides,
  });

const collectEvents = async (
  transport: ReturnType<typeof createSseTransport>,
): Promise<readonly Readonly<Record<string, unknown>>[]> => {
  const collected = new Map<number, Readonly<Record<string, unknown>>>();
  for await (const flattened of transport.events()) collected.set(collected.size, flattened);
  return [...collected.values()];
};

const rejectionOf = async (connecting: Promise<void>): Promise<unknown> => {
  try {
    await connecting;
    return undefined;
  } catch (connectFailure) {
    return connectFailure;
  }
};

describe("接続リクエストの形", () => {
  test("クエリは mode のみで認可ヘッダは提供者の値がそのまま入る", async () => {
    const { fetchImpl, requests } = capturingFetch([
      () => sseResponse(envelopeFrame({ id: "evt-1", prNumber: 7 })),
    ]);
    const transport = transportWith({ fetchImpl });
    const connecting = transport.connect();
    const consumed = collectEvents(transport);
    await connecting;
    const [firstRequest] = requests();
    expect([
      firstRequest?.headers,
      (await consumed).map((flattened) => flattened.delivery_id),
    ]).toStrictEqual([
      { accept: "text/event-stream", authorization: "Bearer connection-credential" },
      ["evt-1"],
    ]);
  });

  test("配信済み id を持って再接続すると Last-Event-ID ヘッダが付く", async () => {
    const disconnectAfterSecond = new Map([["transport", null as null | (() => void)]]);
    const { fetchImpl, requests } = capturingFetch([
      () => sseResponse(envelopeFrame({ id: "evt-1", prNumber: 7 })),
      () => {
        disconnectAfterSecond.get("transport")?.();
        return sseResponse("");
      },
    ]);
    const transport = transportWith({ fetchImpl, reconnectOnClose: true });
    disconnectAfterSecond.set("transport", () => {
      transport.disconnect();
    });
    await transport.connect();
    const secondHeaders = requests()[1]?.headers as Readonly<Record<string, string>>;
    expect(secondHeaders["last-event-id"]).toStrictEqual("evt-1");
  });
});

describe("フレーム処理", () => {
  test("同じ id のフレームは二度処理されない", async () => {
    const body =
      envelopeFrame({ id: "evt-1", prNumber: 7 }) + envelopeFrame({ id: "evt-1", prNumber: 8 });
    const { fetchImpl } = capturingFetch([() => sseResponse(body)]);
    const transport = transportWith({ fetchImpl });
    const connecting = transport.connect();
    const consumed = collectEvents(transport);
    await connecting;
    expect((await consumed).length).toStrictEqual(1);
  });

  test("不正な JSON のフレームは診断ログ付きで捨てられ後続は配送される", async () => {
    const write = vi.fn<(chunk: string) => void>();
    const body = `id: evt-broken\ndata: not-json\n\ndata: also-broken\n\n${envelopeFrame({ id: "evt-2", prNumber: 7 })}`;
    const { fetchImpl } = capturingFetch([() => sseResponse(body)]);
    const transport = transportWith({ fetchImpl, diagnostics: { write } });
    const connecting = transport.connect();
    const consumed = collectEvents(transport);
    await connecting;
    expect([
      (await consumed).map((flattened) => flattened.delivery_id),
      write.mock.calls[0]?.[0]?.startsWith(
        "[sse-transport] Failed to parse or validate frame payload (frameId=evt-broken):",
      ),
      write.mock.calls[1]?.[0]?.includes("(frameId=none)"),
    ]).toStrictEqual([["evt-2"], true, true]);
  });

  test("ping フレームは配送前に破棄される", async () => {
    const body = `event: ping\ndata:\n\n${envelopeFrame({ id: "evt-1", prNumber: 7 })}`;
    const { fetchImpl } = capturingFetch([() => sseResponse(body)]);
    const transport = transportWith({ fetchImpl });
    const connecting = transport.connect();
    const consumed = collectEvents(transport);
    await connecting;
    expect((await consumed).map((flattened) => flattened.delivery_id)).toStrictEqual(["evt-1"]);
  });

  test("既知 id 集合が上限で溢れたら最古が追い出され再送は新規として配送される", async () => {
    const body =
      envelopeFrame({ id: "evt-1", prNumber: 1 }) +
      envelopeFrame({ id: "evt-2", prNumber: 2 }) +
      envelopeFrame({ id: "evt-3", prNumber: 3 }) +
      envelopeFrame({ id: "evt-1", prNumber: 1 });
    const { fetchImpl } = capturingFetch([() => sseResponse(body)]);
    const transport = transportWith({ fetchImpl, knownIdLimit: 2 });
    const connecting = transport.connect();
    const consumed = collectEvents(transport);
    await connecting;
    expect((await consumed).map((flattened) => flattened.delivery_id)).toStrictEqual([
      "evt-1",
      "evt-2",
      "evt-3",
      "evt-1",
    ]);
  });

  test("チャンク境界で割れたフレームはバッファリングして組み立てる", async () => {
    const whole = envelopeFrame({ id: "evt-1", prNumber: 7 });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start: (streamController) => {
        streamController.enqueue(encoder.encode(whole.slice(0, 10)));
        streamController.enqueue(encoder.encode(whole.slice(10)));
        streamController.close();
      },
    });
    const { fetchImpl } = capturingFetch([() => new Response(body, { status: 200 })]);
    const transport = transportWith({ fetchImpl });
    const connecting = transport.connect();
    const consumed = collectEvents(transport);
    await connecting;
    expect((await consumed).length).toStrictEqual(1);
  });
});

describe("接続失敗の分類", () => {
  test("401 と 403 は invalidate を 1 回ずつ呼んでバックオフ再接続する", async () => {
    for (const rejectedStatus of [401, 403]) {
      const credentials = stubCredentials();
      const { fetchImpl, requests } = capturingFetch([
        () => sseResponse(null, rejectedStatus),
        () => sseResponse(""),
      ]);
      const transport = transportWith({ fetchImpl, credentials });
      await transport.connect();
      expect([requests().length, credentials.invalidate.mock.calls.length]).toStrictEqual([2, 1]);
    }
  });

  test("408 と 429 はバックオフ再接続する", async () => {
    const { fetchImpl, requests } = capturingFetch([
      () => sseResponse(null, 408),
      () => sseResponse(null, 429),
      () => sseResponse(""),
    ]);
    const transport = transportWith({ fetchImpl });
    await transport.connect();
    expect(requests().length).toStrictEqual(3);
  });

  test("その他の 4xx は一度も再試行せず専用の致命エラーで拒否する", async () => {
    const { fetchImpl, requests } = capturingFetch([() => sseResponse(null, 404)]);
    const transport = transportWith({ fetchImpl });
    const connecting = transport.connect();
    const consumerDone = transport.events().next();
    const rejection = await rejectionOf(connecting);
    expect([
      rejection instanceof SseRequestRejectedError,
      rejection instanceof Error && "status" in rejection,
      requests().length,
      await consumerDone,
    ]).toStrictEqual([true, false, 1, { done: true, value: undefined }]);
  });

  test("資格情報が根本的に取得できなければ fetch を送らず停止する", async () => {
    const terminal = new CredentialTerminalError("credential source is gone");
    const { fetchImpl, requests } = capturingFetch([() => sseResponse("")]);
    const transport = transportWith({
      fetchImpl,
      credentials: stubCredentials({ authorizationFor: () => Promise.reject(terminal) }),
    });
    await expect(transport.connect()).rejects.toThrow(terminal);
    expect(requests().length).toStrictEqual(0);
  });

  test("disconnect 起因の中断は正常終了でログも出ない", async () => {
    const write = vi.fn<(chunk: string) => void>();
    const holders = new Map([["disconnect", null as null | (() => void)]]);
    const { fetchImpl } = capturingFetch([
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
          holders.get("disconnect")?.();
        }),
    ]);
    const transport = transportWith({ fetchImpl, diagnostics: { write } });
    holders.set("disconnect", () => {
      transport.disconnect();
    });
    await transport.connect();
    expect(write.mock.calls).toStrictEqual([]);
  });
});

describe("再試行打ち切り", () => {
  test("60 秒窓のバックオフ列は 1000 から 29000 まで伸び 7 回試行で最後の失敗のまま拒否する", async () => {
    const clock = new Map([["nowMs", 0]]);
    const write = vi.fn<(chunk: string) => void>();
    const { fetchImpl, requests } = capturingFetch([() => sseResponse(null, 500)]);
    const transport = transportWith({
      fetchImpl,
      diagnostics: { write },
      now: () => clock.get("nowMs") ?? 0,
      sleep: (delayMs) => {
        clock.set("nowMs", (clock.get("nowMs") ?? 0) + delayMs);
        return Promise.resolve();
      },
    });
    const rejection = await rejectionOf(transport.connect());
    const delays = write.mock.calls.map(([line]) => /backing off (\d+)ms/.exec(line)?.[1]);
    expect([requests().length, delays, String(rejection)]).toStrictEqual([
      7,
      ["1000", "2000", "4000", "8000", "16000", "29000"],
      "Error: SSE connect failed: 500",
    ]);
  });

  test("打ち切り Infinity なら窓を超えても再試行を続ける", async () => {
    const failingSix = Array.from({ length: 6 }, () => () => sseResponse(null, 500));
    const { fetchImpl, requests } = capturingFetch([...failingSix, () => sseResponse("")]);
    const transport = transportWith({ fetchImpl, retryDeadlineMs: Number.POSITIVE_INFINITY });
    await transport.connect();
    expect(requests().length).toStrictEqual(7);
  });

  test("応答しない fetch は窓のデッドラインで中断され包み直されて拒否する", async () => {
    const { fetchImpl } = capturingFetch([
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    ]);
    const transport = transportWith({ fetchImpl, retryDeadlineMs: 50 });
    await expect(transport.connect()).rejects.toThrow("SSE retry deadline exceeded");
  });
});

describe("サーバー側クローズと読み取りタイムアウト", () => {
  test("再接続有効ならサーバー側クローズ後にバックオフして再接続する", async () => {
    const write = vi.fn<(chunk: string) => void>();
    const holders = new Map([["disconnect", null as null | (() => void)]]);
    const { fetchImpl, requests } = capturingFetch([
      () => sseResponse(""),
      () => {
        holders.get("disconnect")?.();
        return sseResponse("");
      },
    ]);
    const transport = transportWith({ fetchImpl, reconnectOnClose: true, diagnostics: { write } });
    holders.set("disconnect", () => {
      transport.disconnect();
    });
    await transport.connect();
    expect([
      requests().length,
      write.mock.calls[0]?.[0]?.includes("Error: SSE connection closed by server"),
    ]).toStrictEqual([2, true]);
  });

  test("バイトが来ないストリームは読み取りタイムアウトで切って再接続する", async () => {
    const holders = new Map([["disconnect", null as null | (() => void)]]);
    const silentBody = new ReadableStream<Uint8Array>({ start: () => undefined });
    const { fetchImpl, requests } = capturingFetch([
      () => new Response(silentBody, { status: 200 }),
      () => {
        holders.get("disconnect")?.();
        return sseResponse("");
      },
    ]);
    const transport = transportWith({ fetchImpl, readTimeoutMs: 10, reconnectOnClose: true });
    holders.set("disconnect", () => {
      transport.disconnect();
    });
    await transport.connect();
    expect(requests().length).toStrictEqual(2);
  });

  test("body の無い応答はサーバー側クローズとして扱う", async () => {
    const { fetchImpl, requests } = capturingFetch([() => sseResponse(null)]);
    const transport = transportWith({ fetchImpl });
    await transport.connect();
    expect(requests().length).toStrictEqual(1);
  });
});

describe("ライフサイクル", () => {
  test("接続中の connect 再呼び出しは無操作になる", async () => {
    const holders = new Map([["disconnect", null as null | (() => void)]]);
    const { fetchImpl, requests } = capturingFetch([
      async () => {
        const transportDisconnect = holders.get("disconnect");
        await Promise.resolve();
        transportDisconnect?.();
        return sseResponse("");
      },
    ]);
    const transport = transportWith({ fetchImpl });
    const firstConnect = transport.connect();
    await transport.connect();
    holders.set("disconnect", () => {
      transport.disconnect();
    });
    await firstConnect;
    expect(requests().length).toStrictEqual(1);
  });

  test("connect 前に disconnect すると events は 1 件も配らず即終端する", async () => {
    const transport = createSseTransport({
      url: "http://relay.internal/events/stream",
      credentials: stubCredentials(),
      mode: "author",
    });
    transport.disconnect();
    expect(await transport.events().next()).toStrictEqual({ done: true, value: undefined });
  });

  test("既定の sleep はバックオフ後に再試行し disconnect で中断できる", async () => {
    const holders = new Map([["disconnect", null as null | (() => void)]]);
    const { fetchImpl, requests } = capturingFetch([
      () => sseResponse(null, 500),
      () => {
        holders.get("disconnect")?.();
        return sseResponse("");
      },
    ]);
    const transport = transportWith({ fetchImpl, sleep: undefined });
    holders.set("disconnect", () => {
      transport.disconnect();
    });
    await transport.connect();
    expect(requests().length).toStrictEqual(2);
  }, 10_000);

  test("バックオフ sleep 自体の失敗は中断ではないので connect の拒否になる", async () => {
    const { fetchImpl } = capturingFetch([() => sseResponse(null, 500)]);
    const transport = transportWith({
      fetchImpl,
      sleep: () => Promise.reject(new Error("timer broke")),
    });
    await expect(transport.connect()).rejects.toThrow("timer broke");
  });

  test("既定 sleep 中の disconnect は中断として正常終了する", async () => {
    const { fetchImpl, requests } = capturingFetch([() => sseResponse(null, 500)]);
    const transport = transportWith({ fetchImpl, sleep: undefined, reconnectOnClose: true });
    const connecting = transport.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    transport.disconnect();
    await expect(connecting).resolves.toStrictEqual(undefined);
    expect(requests().length).toStrictEqual(1);
  });
});
