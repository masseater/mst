import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createMemoryCursorStore, createMemoryEventStore } from "./memory-store.ts";
import { createOwnerFilter } from "./owner-filter.ts";
import { runEventStream, type SseSink } from "./sse.ts";

import type { GithubReader } from "./github-reader.ts";
import type { EventStore, StoredEvent } from "./store.ts";

const stubGithub = (overrides: Partial<GithubReader> = {}): GithubReader => ({
  resolveTokenLogin: () => Promise.resolve("octocat"),
  readRepositoryPrivacy: () => Promise.resolve(true),
  listOpenPullRequests: () => Promise.resolve([]),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve([]),
  ...overrides,
});

const authoredEvent = (
  id: string,
  shape: { readonly receivedAtMs: number; readonly authorLogin?: string | null },
): StoredEvent => ({
  id,
  eventType: "pull_request",
  deliveryId: id,
  payload: {
    action: "opened",
    pull_request:
      shape.authorLogin === null
        ? { number: 7 }
        : { number: 7, user: { login: shape.authorLogin ?? "octocat" } },
  },
  receivedAtMs: shape.receivedAtMs,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
});

const recordingSink = (): {
  readonly sink: SseSink;
  readonly writtenIds: () => readonly string[];
} => {
  const frames = new Map<number, string>();
  return {
    sink: {
      writeEvent: (frame) => {
        frames.set(frames.size, frame.eventId);
      },
      writeKeepalive: () => undefined,
    },
    writtenIds: () => [...frames.values()],
  };
};

const settleQueue = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const startStream = (session: {
  readonly events: EventStore;
  readonly cursors: ReturnType<typeof createMemoryCursorStore>;
  readonly sink: SseSink;
  readonly lastEventId?: string | null;
  readonly github?: GithubReader;
}): { readonly finished: Promise<void>; readonly hangup: () => void } => {
  const clientHangup = new AbortController();
  const finished = runEventStream({
    clientId: "octocat-author",
    subscriberLogin: "octocat",
    lastEventId: session.lastEventId ?? null,
    events: session.events,
    cursors: session.cursors,
    ownerFilter: createOwnerFilter({
      events: session.events,
      github: session.github ?? stubGithub(),
    }),
    sink: session.sink,
    clientAbort: clientHangup.signal,
    log: silentLogger,
  });
  return {
    finished,
    hangup: () => {
      clientHangup.abort();
    },
  };
};

const it = test
  .extend("mixedBacklogStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: nowMs - 3000 }));
    await events.createIfAbsent(
      authoredEvent("delivery-2", { receivedAtMs: nowMs - 2000, authorLogin: "hubot" }),
    );
    await events.createIfAbsent(authoredEvent("delivery-3", { receivedAtMs: nowMs - 1000 }));
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink });
    await settleQueue();
    stream.hangup();
    await stream.finished;
    const cursorAfterStream = await cursors.read("octocat-author");
    return { writtenEventIds: writtenIds(), cursorAfterStream };
  })
  .extend("lastEventIdStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: 100 }));
    await events.createIfAbsent(authoredEvent("delivery-2", { receivedAtMs: 200 }));
    await events.createIfAbsent(authoredEvent("delivery-3", { receivedAtMs: 300 }));
    await cursors.write({ clientId: "octocat-author", eventId: "delivery-2" });
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink, lastEventId: "delivery-1" });
    await settleQueue();
    stream.hangup();
    await stream.finished;
    return writtenIds();
  })
  .extend("fallbackStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    await events.createIfAbsent(
      authoredEvent("delivery-recent", { receivedAtMs: Date.now() - 1000 }),
    );
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink, lastEventId: "delivery-vanished" });
    await settleQueue();
    stream.hangup();
    await stream.finished;
    return writtenIds();
  })
  .extend("unresolvableOwnerStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const nowMs = Date.now();
    await events.createIfAbsent({
      id: "delivery-unresolvable",
      eventType: "pull_request",
      deliveryId: "delivery-unresolvable",
      payload: { action: "opened", pull_request: { number: 9 } },
      receivedAtMs: nowMs - 2000,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
    });
    await events.createIfAbsent(authoredEvent("delivery-owned", { receivedAtMs: nowMs - 1000 }));
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({
      events,
      cursors,
      sink,
      github: stubGithub({
        resolvePullAuthor: () => Promise.reject(new Error("github unreachable")),
      }),
    });
    await stream.finished;
    const cursorAfterStream = await cursors.read("octocat-author");
    return { writtenEventIds: writtenIds(), cursorAfterStream };
  })
  .extend("liveDeliveryStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink });
    await settleQueue();
    await events.createIfAbsent(authoredEvent("delivery-live", { receivedAtMs: Date.now() }));
    await settleQueue();
    stream.hangup();
    await stream.finished;
    const cursorAfterStream = await cursors.read("octocat-author");
    return { writtenEventIds: writtenIds(), cursorAfterStream };
  })
  .extend("replayedLiveIdStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: nowMs - 1000 }));
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink });
    await settleQueue();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: nowMs }));
    await settleQueue();
    stream.hangup();
    await stream.finished;
    return writtenIds();
  })
  .extend("failingSinkCursor", async () => {
    const cursors = createMemoryCursorStore();
    const events = createMemoryEventStore();
    const failingSink: SseSink = {
      writeEvent: () => {
        throw new Error("socket closed");
      },
      writeKeepalive: () => undefined,
    };
    const stream = startStream({ events, cursors, sink: failingSink });
    await settleQueue();
    await events.createIfAbsent(authoredEvent("delivery-live", { receivedAtMs: Date.now() }));
    await settleQueue();
    await stream.finished;
    return cursors.read("octocat-author");
  })
  .extend("serialLiveStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink });
    await settleQueue();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-live-1", { receivedAtMs: nowMs }));
    await events.createIfAbsent(authoredEvent("delivery-live-2", { receivedAtMs: nowMs + 1 }));
    await settleQueue();
    stream.hangup();
    await stream.finished;
    return writtenIds();
  })
  .extend("emptyBacklogLiveStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink, lastEventId: "delivery-vanished" });
    await settleQueue();
    await events.createIfAbsent(authoredEvent("delivery-live", { receivedAtMs: Date.now() }));
    await settleQueue();
    stream.hangup();
    await stream.finished;
    return writtenIds();
  })
  .extend("evictingKnownIdStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const { sink, writtenIds } = recordingSink();
    const clientHangup = new AbortController();
    const finished = runEventStream({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      lastEventId: null,
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub() }),
      sink,
      clientAbort: clientHangup.signal,
      log: silentLogger,
      knownIdLimit: 1,
    });
    await settleQueue();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-live-1", { receivedAtMs: nowMs }));
    await settleQueue();
    await events.createIfAbsent(authoredEvent("delivery-live-2", { receivedAtMs: nowMs + 1 }));
    await settleQueue();
    clientHangup.abort();
    await finished;
    return writtenIds();
  })
  .extend("hangupDuringReplayStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: nowMs - 2000 }));
    await events.createIfAbsent(authoredEvent("delivery-2", { receivedAtMs: nowMs - 1000 }));
    const clientHangup = new AbortController();
    const frames = new Map<number, string>();
    await runEventStream({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      lastEventId: null,
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub() }),
      sink: {
        writeEvent: (frame) => {
          frames.set(frames.size, frame.eventId);
          clientHangup.abort();
        },
        writeKeepalive: () => undefined,
      },
      clientAbort: clientHangup.signal,
      log: silentLogger,
    });
    return [...frames.values()];
  })
  .extend("lateOwnerResolutionStream", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const resolverGate = new Map<string, (login: string | null) => void>();
    const gatedGithub = stubGithub({
      resolvePullAuthor: () =>
        new Promise((resolve) => {
          resolverGate.set("release", resolve);
        }),
    });
    const { sink, writtenIds } = recordingSink();
    const stream = startStream({ events, cursors, sink, github: gatedGithub });
    await settleQueue();
    const nowMs = Date.now();
    await events.createIfAbsent({
      id: "delivery-slow",
      eventType: "pull_request",
      deliveryId: "delivery-slow",
      payload: { action: "opened", pull_request: { number: 9 } },
      receivedAtMs: nowMs,
      expiresAtMs: Number.MAX_SAFE_INTEGER,
    });
    await events.createIfAbsent(authoredEvent("delivery-after", { receivedAtMs: nowMs + 1 }));
    await settleQueue();
    stream.hangup();
    resolverGate.get("release")?.("octocat");
    await stream.finished;
    await settleQueue();
    const cursorAfterStream = await cursors.read("octocat-author");
    return { writtenEventIds: writtenIds(), cursorAfterStream };
  })
  .extend("failingKeepaliveSpy", async () => {
    const writeKeepalive = vi.fn<() => void>(() => {
      throw new Error("socket closed");
    });
    const events = createMemoryEventStore();
    const clientHangup = new AbortController();
    await runEventStream({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      lastEventId: null,
      events,
      cursors: createMemoryCursorStore(),
      ownerFilter: createOwnerFilter({ events, github: stubGithub() }),
      sink: { writeEvent: () => undefined, writeKeepalive },
      clientAbort: clientHangup.signal,
      log: silentLogger,
      keepaliveMs: 1,
    });
    return writeKeepalive;
  });

describe("バックログ再生", () => {
  it("所有イベントだけが配信される", ({ mixedBacklogStream }) => {
    expect(mixedBacklogStream.writtenEventIds).toStrictEqual(["delivery-1", "delivery-3"]);
  });

  it("1 件ごとにカーソルが進む", ({ mixedBacklogStream }) => {
    expect(mixedBacklogStream.cursorAfterStream).toStrictEqual("delivery-3");
  });

  it("Last-Event-ID は保存カーソルより優先される", ({ lastEventIdStream }) => {
    expect(lastEventIdStream).toStrictEqual(["delivery-2", "delivery-3"]);
  });

  it("再開位置のイベントが消えていたら replay window にフォールバックする", ({
    fallbackStream,
  }) => {
    expect(fallbackStream).toStrictEqual(["delivery-recent"]);
  });

  it("所有者を解決できないイベントで再生が中断される", ({ unresolvableOwnerStream }) => {
    expect(unresolvableOwnerStream.writtenEventIds).toStrictEqual([]);
  });

  it("所有者を解決できないイベントではカーソルは進まない", ({ unresolvableOwnerStream }) => {
    expect(unresolvableOwnerStream.cursorAfterStream).toStrictEqual(null);
  });
});

describe("live 配信", () => {
  it("live の追加イベントは配信される", ({ liveDeliveryStream }) => {
    expect(liveDeliveryStream.writtenEventIds).toStrictEqual(["delivery-live"]);
  });

  it("live の追加イベントでカーソルが進む", ({ liveDeliveryStream }) => {
    expect(liveDeliveryStream.cursorAfterStream).toStrictEqual("delivery-live");
  });

  it("バックログと同一 ID の live イベントは重複配信されない", ({ replayedLiveIdStream }) => {
    expect(replayedLiveIdStream).toStrictEqual(["delivery-1"]);
  });

  it("SSE 書き込み失敗でストリームは停止する", ({ failingSinkCursor }) => {
    expect(failingSinkCursor).toStrictEqual(null);
  });

  it("live 配信は到着順に直列処理される", ({ serialLiveStream }) => {
    expect(serialLiveStream).toStrictEqual(["delivery-live-1", "delivery-live-2"]);
  });
});

describe("live watch の開始位置", () => {
  it("バックログが空で再開位置のイベントも消えていれば時刻起点で購読する", ({
    emptyBacklogLiveStream,
  }) => {
    expect(emptyBacklogLiveStream).toStrictEqual(["delivery-live"]);
  });

  it("既知 ID 集合は上限を超えると最古から追い出される", ({ evictingKnownIdStream }) => {
    expect(evictingKnownIdStream).toStrictEqual(["delivery-live-1", "delivery-live-2"]);
  });
});

describe("停止後の抑止", () => {
  it("再生の途中で停止したら残りのバックログは配られない", ({ hangupDuringReplayStream }) => {
    expect(hangupDuringReplayStream).toStrictEqual(["delivery-1"]);
  });

  it("停止後に完了した所有者判定は書き込まれない", ({ lateOwnerResolutionStream }) => {
    expect(lateOwnerResolutionStream.writtenEventIds).toStrictEqual([]);
  });

  it("停止後はキューの後続も走らずカーソルは進まない", ({ lateOwnerResolutionStream }) => {
    expect(lateOwnerResolutionStream.cursorAfterStream).toStrictEqual(null);
  });
});

describe("keepalive と切断", () => {
  it("keepalive の書き込み失敗でストリームは停止する", ({ failingKeepaliveSpy }) => {
    expect(failingKeepaliveSpy).toHaveBeenCalledTimes(1);
  });

  it("クライアント切断でストリームは終了する", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const stream = startStream({ events, cursors, sink: recordingSink().sink });
    await settleQueue();
    stream.hangup();
    await expect(stream.finished).resolves.toStrictEqual(undefined);
  });
});
