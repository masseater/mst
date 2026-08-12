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

type StubbedCredentials = CredentialProvider & { readonly invalidate: ReturnType<typeof vi.fn> };

const stubCredentials = (overrides: Partial<CredentialProvider> = {}): StubbedCredentials => {
  const invalidate = vi.fn<() => void>();
  return {
    authorizationFor: () => Promise.resolve("Bearer connection-credential"),
    ...overrides,
    invalidate,
  };
};

const terminalCredentials = stubCredentials({
  authorizationFor: () => Promise.reject(new CredentialTerminalError("credential source is gone")),
});

const sseResponse = (body: string | null, status = 200): Response => new Response(body, { status });

type PlannedResponse = (planning: {
  readonly init: RequestInit | undefined;
  readonly disconnect: () => void;
}) => Response | Promise<Response>;

const rejectOnAbort: PlannedResponse = ({ init }) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("aborted", "AbortError"));
    });
  });

const abortByDisconnect: PlannedResponse = (planning) => {
  const pending = rejectOnAbort(planning);
  planning.disconnect();
  return pending;
};

const disconnectThenClose: PlannedResponse = ({ disconnect }) => {
  disconnect();
  return sseResponse("");
};

const silentStream = (): Response =>
  new Response(new ReadableStream<Uint8Array>({ start: () => undefined }), { status: 200 });

const settledConnect = async (
  connecting: Promise<unknown>,
): Promise<{ readonly connectValue: unknown; readonly rejection: unknown }> => {
  try {
    return { connectValue: await connecting, rejection: undefined };
  } catch (connectFailure) {
    return { connectValue: undefined, rejection: connectFailure };
  }
};

const probeTransport = async (setup: {
  readonly plannedResponses: readonly PlannedResponse[];
  readonly config?: Partial<SseTransportConfig>;
  readonly credentials?: StubbedCredentials;
  readonly consume?: boolean;
  readonly stepOnce?: boolean;
  readonly connectTwice?: boolean;
  readonly disconnectAfterMs?: number;
}) => {
  const written = new Map<number, string>();
  const calls = new Map<number, RequestInit | undefined>();
  const credentials = setup.credentials ?? stubCredentials();
  const holder = new Map<string, () => void>();
  const fetchImpl = ((_input: unknown, init?: RequestInit) => {
    const index = calls.size;
    calls.set(index, init);
    const planned = setup.plannedResponses[Math.min(index, setup.plannedResponses.length - 1)];
    if (planned === undefined) throw new Error("no planned response configured");
    return Promise.resolve(
      planned({
        init,
        disconnect: () => {
          holder.get("disconnect")?.();
        },
      }),
    );
  }) as typeof fetch;
  const transport = createSseTransport({
    url: "http://relay.internal/events/stream",
    credentials,
    mode: "author",
    reconnectOnClose: false,
    random: () => 0.5,
    sleep: () => Promise.resolve(),
    ...setup.config,
    fetchImpl,
    diagnostics: {
      write: (chunk) => {
        written.set(written.size, chunk);
      },
    },
  });
  holder.set("disconnect", () => {
    transport.disconnect();
  });
  const connecting: Promise<unknown> = transport.connect();
  const consuming = setup.consume === true ? Array.fromAsync(transport.events()) : undefined;
  const stepping = setup.stepOnce === true ? transport.events().next() : undefined;
  if (setup.connectTwice === true) await transport.connect();
  if (setup.disconnectAfterMs !== undefined) {
    await new Promise((resolve) => setTimeout(resolve, setup.disconnectAfterMs));
    transport.disconnect();
  }
  const settled = await settledConnect(connecting);
  const delivered = consuming === undefined ? [] : await consuming;
  const diagnosticLines = [...written.values()];
  return {
    deliveredIds: delivered.map((flattened) => flattened.delivery_id),
    requests: [...calls.values()].map((init) => init ?? {}),
    requestCount: calls.size,
    diagnosticLines,
    backoffDelays: diagnosticLines.map((line) => /backing off (\d+)ms/u.exec(line)?.[1]),
    invalidateCount: credentials.invalidate.mock.calls.length,
    rejection: settled.rejection,
    rejectionText: String(settled.rejection),
    carriesStatusProperty: settled.rejection instanceof Error && "status" in settled.rejection,
    connectValue: settled.connectValue,
    consumerStep: stepping === undefined ? undefined : await stepping,
  };
};

const probeBody = (body: string, config?: Partial<SseTransportConfig>) =>
  probeTransport({ plannedResponses: [() => sseResponse(body)], config, consume: true });

const probeRejectedStatus = (rejectedStatus: number) =>
  probeTransport({
    plannedResponses: [() => sseResponse(null, rejectedStatus), () => sseResponse("")],
  });

const probeEarlyDisconnect = () => {
  const transport = createSseTransport({
    url: "http://relay.internal/events/stream",
    credentials: stubCredentials(),
    mode: "author",
  });
  transport.disconnect();
  return transport.events().next();
};

const it = test
  .extend("singleFrameProbe", () => probeBody(envelopeFrame({ id: "evt-1", prNumber: 7 })))
  .extend("resumedProbe", () =>
    probeTransport({
      plannedResponses: [
        () => sseResponse(envelopeFrame({ id: "evt-1", prNumber: 7 })),
        disconnectThenClose,
      ],
      config: { reconnectOnClose: true },
    }),
  )
  .extend("repeatedIdProbe", () =>
    probeBody(
      envelopeFrame({ id: "evt-1", prNumber: 7 }) + envelopeFrame({ id: "evt-1", prNumber: 8 }),
    ),
  )
  .extend("brokenJsonProbe", () =>
    probeBody(
      `id: evt-broken\ndata: not-json\n\ndata: also-broken\n\n${envelopeFrame({ id: "evt-2", prNumber: 7 })}`,
    ),
  )
  .extend("pingProbe", () =>
    probeBody(`event: ping\ndata:\n\n${envelopeFrame({ id: "evt-1", prNumber: 7 })}`),
  )
  .extend("evictionProbe", () =>
    probeBody(
      [1, 2, 3, 1].map((prNumber) => envelopeFrame({ id: `evt-${prNumber}`, prNumber })).join(""),
      { knownIdLimit: 2 },
    ),
  )
  .extend("splitChunkProbe", () => {
    const whole = envelopeFrame({ id: "evt-1", prNumber: 7 });
    const encoder = new TextEncoder();
    const parts = [whole.slice(0, 10), whole.slice(10)].map((part) => encoder.encode(part));
    return probeTransport({
      plannedResponses: [() => new Response(ReadableStream.from(parts), { status: 200 })],
      consume: true,
    });
  })
  .extend("unauthorizedProbe", () => probeRejectedStatus(401))
  .extend("forbiddenProbe", () => probeRejectedStatus(403))
  .extend("retriedStatusProbe", () =>
    probeTransport({
      plannedResponses: [
        () => sseResponse(null, 408),
        () => sseResponse(null, 429),
        () => sseResponse(""),
      ],
    }),
  )
  .extend("notFoundProbe", () =>
    probeTransport({ plannedResponses: [() => sseResponse(null, 404)], stepOnce: true }),
  )
  .extend("credentialGoneProbe", () =>
    probeTransport({
      plannedResponses: [() => sseResponse("")],
      credentials: terminalCredentials,
    }),
  )
  .extend("abortedFetchProbe", () => probeTransport({ plannedResponses: [abortByDisconnect] }))
  .extend("exhaustedRetryProbe", () => {
    const clock = new Map([["nowMs", 0]]);
    return probeTransport({
      plannedResponses: [() => sseResponse(null, 500)],
      config: {
        now: () => clock.get("nowMs") ?? 0,
        sleep: (delayMs) => {
          clock.set("nowMs", (clock.get("nowMs") ?? 0) + delayMs);
          return Promise.resolve();
        },
      },
    });
  })
  .extend("endlessRetryProbe", () =>
    probeTransport({
      plannedResponses: [
        ...Array.from({ length: 6 }, (): PlannedResponse => () => sseResponse(null, 500)),
        () => sseResponse(""),
      ],
      config: { retryDeadlineMs: Number.POSITIVE_INFINITY },
    }),
  )
  .extend("stalledFetchProbe", () =>
    probeTransport({ plannedResponses: [rejectOnAbort], config: { retryDeadlineMs: 50 } }),
  )
  .extend("serverClosedProbe", () =>
    probeTransport({
      plannedResponses: [() => sseResponse(""), disconnectThenClose],
      config: { reconnectOnClose: true },
    }),
  )
  .extend("readTimeoutProbe", () =>
    probeTransport({
      plannedResponses: [silentStream, disconnectThenClose],
      config: { readTimeoutMs: 10, reconnectOnClose: true },
    }),
  )
  .extend("bodylessProbe", () => probeTransport({ plannedResponses: [() => sseResponse(null)] }))
  .extend("reentrantProbe", () =>
    probeTransport({ plannedResponses: [() => sseResponse("")], connectTwice: true }),
  )
  .extend("earlyDisconnectStep", () => probeEarlyDisconnect())
  .extend("realSleepProbe", () =>
    probeTransport({
      plannedResponses: [() => sseResponse(null, 500), disconnectThenClose],
      config: { sleep: undefined },
    }),
  )
  .extend("brokenSleepProbe", () =>
    probeTransport({
      plannedResponses: [() => sseResponse(null, 500)],
      config: { sleep: () => Promise.reject(new Error("timer broke")) },
    }),
  )
  .extend("interruptedSleepProbe", () =>
    probeTransport({
      plannedResponses: [() => sseResponse(null, 500)],
      config: { sleep: undefined, reconnectOnClose: true },
      disconnectAfterMs: 20,
    }),
  );

describe("接続リクエストの形", () => {
  it("認可ヘッダは提供者の値がそのまま入る", ({ singleFrameProbe }) => {
    expect(singleFrameProbe.requests[0]?.headers).toStrictEqual({
      accept: "text/event-stream",
      authorization: "Bearer connection-credential",
    });
  });

  it("受け取ったフレームは配送される", ({ singleFrameProbe }) => {
    expect(singleFrameProbe.deliveredIds).toStrictEqual(["evt-1"]);
  });

  it("配信済み id を持って再接続すると Last-Event-ID が付く", ({ resumedProbe }) => {
    const resumeHeaders = resumedProbe.requests[1]?.headers as Readonly<Record<string, string>>;
    expect(resumeHeaders["last-event-id"]).toStrictEqual("evt-1");
  });
});

describe("フレーム処理", () => {
  it("同じ id のフレームは二度処理されない", ({ repeatedIdProbe }) => {
    expect(repeatedIdProbe.deliveredIds).toStrictEqual(["evt-1"]);
  });

  it("不正な JSON のフレームは捨てられ後続は配送される", ({ brokenJsonProbe }) => {
    expect(brokenJsonProbe.deliveredIds).toStrictEqual(["evt-2"]);
  });

  it("id を持つ不正フレームは frameId 付きで診断ログに出る", ({ brokenJsonProbe }) => {
    expect(brokenJsonProbe.diagnosticLines[0]).toMatch(
      /^\[sse-transport\] Failed to parse or validate frame payload \(frameId=evt-broken\):/u,
    );
  });

  it("id の無い不正フレームは frameId=none で診断ログに出る", ({ brokenJsonProbe }) => {
    expect(brokenJsonProbe.diagnosticLines[1]).toContain("(frameId=none)");
  });

  it("ping フレームは配送前に破棄される", ({ pingProbe }) => {
    expect(pingProbe.deliveredIds).toStrictEqual(["evt-1"]);
  });

  it("既知 id が上限で溢れたら最古が追い出され再送も配送される", ({ evictionProbe }) => {
    expect(evictionProbe.deliveredIds).toStrictEqual(["evt-1", "evt-2", "evt-3", "evt-1"]);
  });

  it("チャンク境界で割れたフレームは組み立てられる", ({ splitChunkProbe }) => {
    expect(splitChunkProbe.deliveredIds).toStrictEqual(["evt-1"]);
  });
});

describe("接続失敗の分類", () => {
  it("401 はバックオフ再接続する", ({ unauthorizedProbe }) => {
    expect(unauthorizedProbe.requestCount).toStrictEqual(2);
  });

  it("401 は invalidate を 1 回だけ呼ぶ", ({ unauthorizedProbe }) => {
    expect(unauthorizedProbe.invalidateCount).toStrictEqual(1);
  });

  it("403 はバックオフ再接続する", ({ forbiddenProbe }) => {
    expect(forbiddenProbe.requestCount).toStrictEqual(2);
  });

  it("403 は invalidate を 1 回だけ呼ぶ", ({ forbiddenProbe }) => {
    expect(forbiddenProbe.invalidateCount).toStrictEqual(1);
  });

  it("408 と 429 はバックオフ再接続する", ({ retriedStatusProbe }) => {
    expect(retriedStatusProbe.requestCount).toStrictEqual(3);
  });

  it("その他の 4xx は専用の致命エラーで拒否する", ({ notFoundProbe }) => {
    expect(notFoundProbe.rejection).toBeInstanceOf(SseRequestRejectedError);
  });

  it("その他の 4xx の致命エラーは status を持たない", ({ notFoundProbe }) => {
    expect(notFoundProbe.carriesStatusProperty).toStrictEqual(false);
  });

  it("その他の 4xx は一度も再試行しない", ({ notFoundProbe }) => {
    expect(notFoundProbe.requestCount).toStrictEqual(1);
  });

  it("その他の 4xx では消費側が即終端する", ({ notFoundProbe }) => {
    expect(notFoundProbe.consumerStep).toStrictEqual({ done: true, value: undefined });
  });

  it("資格情報が根本的に取得できなければ停止する", ({ credentialGoneProbe }) => {
    expect(credentialGoneProbe.rejection).toBeInstanceOf(CredentialTerminalError);
  });

  it("資格情報が根本的に取得できなければ fetch を送らない", ({ credentialGoneProbe }) => {
    expect(credentialGoneProbe.requestCount).toStrictEqual(0);
  });

  it("disconnect 起因の中断は正常終了でログも出ない", ({ abortedFetchProbe }) => {
    expect(abortedFetchProbe.diagnosticLines).toStrictEqual([]);
  });
});

describe("再試行打ち切り", () => {
  it("60 秒窓では 7 回試行して打ち切る", ({ exhaustedRetryProbe }) => {
    expect(exhaustedRetryProbe.requestCount).toStrictEqual(7);
  });

  it("バックオフ列は 1000 から 29000 まで伸びる", ({ exhaustedRetryProbe }) => {
    expect(exhaustedRetryProbe.backoffDelays).toStrictEqual([
      "1000",
      "2000",
      "4000",
      "8000",
      "16000",
      "29000",
    ]);
  });

  it("打ち切りは最後の失敗のまま拒否する", ({ exhaustedRetryProbe }) => {
    expect(exhaustedRetryProbe.rejectionText).toStrictEqual("Error: SSE connect failed: 500");
  });

  it("打ち切り Infinity なら窓を超えても再試行を続ける", ({ endlessRetryProbe }) => {
    expect(endlessRetryProbe.requestCount).toStrictEqual(7);
  });

  it("応答しない fetch は窓のデッドラインで包み直して拒否する", ({ stalledFetchProbe }) => {
    expect(stalledFetchProbe.rejectionText).toContain("SSE retry deadline exceeded");
  });
});

describe("サーバー側クローズと読み取りタイムアウト", () => {
  it("再接続有効ならサーバー側クローズ後に再接続する", ({ serverClosedProbe }) => {
    expect(serverClosedProbe.requestCount).toStrictEqual(2);
  });

  it("サーバー側クローズはバックオフのログに残る", ({ serverClosedProbe }) => {
    expect(serverClosedProbe.diagnosticLines[0]).toContain(
      "Error: SSE connection closed by server",
    );
  });

  it("バイトが来ないストリームは読み取りタイムアウトで切る", ({ readTimeoutProbe }) => {
    expect(readTimeoutProbe.requestCount).toStrictEqual(2);
  });

  it("body の無い応答はサーバー側クローズとして扱う", ({ bodylessProbe }) => {
    expect(bodylessProbe.requestCount).toStrictEqual(1);
  });
});

describe("ライフサイクル", () => {
  it("接続中の connect 再呼び出しは無操作になる", ({ reentrantProbe }) => {
    expect(reentrantProbe.requestCount).toStrictEqual(1);
  });

  it("connect 前の disconnect で events は即終端する", ({ earlyDisconnectStep }) => {
    expect(earlyDisconnectStep).toStrictEqual({ done: true, value: undefined });
  });

  it("既定の sleep はバックオフ後に再試行し disconnect で中断できる", ({ realSleepProbe }) => {
    expect(realSleepProbe.requestCount).toStrictEqual(2);
  }, 10_000);

  it("バックオフ sleep 自体の失敗は connect の拒否になる", ({ brokenSleepProbe }) => {
    expect(brokenSleepProbe.rejectionText).toStrictEqual("Error: timer broke");
  });

  it("既定 sleep 中の disconnect は中断として正常終了する", ({ interruptedSleepProbe }) => {
    expect(interruptedSleepProbe.connectValue).toStrictEqual(undefined);
  });

  it("既定 sleep 中の disconnect 後は再試行しない", ({ interruptedSleepProbe }) => {
    expect(interruptedSleepProbe.requestCount).toStrictEqual(1);
  });
});
