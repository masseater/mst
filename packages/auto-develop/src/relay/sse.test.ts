import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createMemoryCursorStore } from "./memory-cursor-store.ts";
import { createMemoryEventStore } from "./memory-event-store.ts";
import { createOwnerFilter } from "./owner-filter.ts";
import { runEventStream } from "./sse.ts";

import type { StoredEvent } from "./store.ts";

const streamStartMs = 1_700_000_000_000;

const octocatBacklogEvent: StoredEvent = {
  id: "delivery-1",
  eventType: "pull_request",
  deliveryId: "delivery-1",
  payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
  receivedAtMs: streamStartMs - 3000,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
};

const hubotBacklogEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-2",
  deliveryId: "delivery-2",
  payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
  receivedAtMs: streamStartMs - 2000,
};

const middleOctocatBacklogEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-2",
  deliveryId: "delivery-2",
  receivedAtMs: streamStartMs - 2000,
};

const laterOctocatBacklogEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-3",
  deliveryId: "delivery-3",
  receivedAtMs: streamStartMs - 1000,
};

const recentOctocatBacklogEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-recent",
  deliveryId: "delivery-recent",
  receivedAtMs: streamStartMs - 1000,
};

const authorlessBacklogEvent: StoredEvent = {
  id: "delivery-unresolvable",
  eventType: "pull_request",
  deliveryId: "delivery-unresolvable",
  payload: { action: "opened", pull_request: { number: 9 } },
  receivedAtMs: streamStartMs - 2000,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
};

const ownedAfterAuthorlessEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-owned",
  deliveryId: "delivery-owned",
  receivedAtMs: streamStartMs - 1000,
};

const liveOctocatEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-live",
  deliveryId: "delivery-live",
  receivedAtMs: streamStartMs,
};

const replayedOctocatEvent: StoredEvent = {
  ...octocatBacklogEvent,
  receivedAtMs: streamStartMs,
};

const firstSerialLiveEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-live-1",
  deliveryId: "delivery-live-1",
  receivedAtMs: streamStartMs,
};

const secondSerialLiveEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-live-2",
  deliveryId: "delivery-live-2",
  receivedAtMs: streamStartMs + 1,
};

const slowAuthorlessLiveEvent: StoredEvent = {
  id: "delivery-slow",
  eventType: "pull_request",
  deliveryId: "delivery-slow",
  payload: { action: "opened", pull_request: { number: 9 } },
  receivedAtMs: streamStartMs,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
};

const followingOctocatLiveEvent: StoredEvent = {
  ...octocatBacklogEvent,
  id: "delivery-after",
  deliveryId: "delivery-after",
  receivedAtMs: streamStartMs + 1,
};

describe("バックログ再生", () => {
  const it = test
    .extend("mixedBacklogWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(octocatBacklogEvent);
      await eventStore.createIfAbsent(hubotBacklogEvent);
      await eventStore.createIfAbsent(laterOctocatBacklogEvent);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    })
    .extend("mixedBacklogCursor", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(octocatBacklogEvent);
      await eventStore.createIfAbsent(hubotBacklogEvent);
      await eventStore.createIfAbsent(laterOctocatBacklogEvent);
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: () => undefined,
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return cursorStore.read("octocat-author");
    })
    .extend("headerResumedWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(octocatBacklogEvent);
      await eventStore.createIfAbsent(middleOctocatBacklogEvent);
      await eventStore.createIfAbsent(laterOctocatBacklogEvent);
      await cursorStore.write({ clientId: "octocat-author", eventId: "delivery-2" });
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: "delivery-1",
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    })
    .extend("vanishedResumeWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(recentOctocatBacklogEvent);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: "delivery-vanished",
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    })
    .extend("unresolvableOwnerWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(authorlessBacklogEvent);
      await eventStore.createIfAbsent(ownedAfterAuthorlessEvent);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      await runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.reject(new Error("github unreachable")),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      return writtenEventIds;
    })
    .extend("unresolvableOwnerCursor", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(authorlessBacklogEvent);
      await eventStore.createIfAbsent(ownedAfterAuthorlessEvent);
      const clientHangup = new AbortController();
      await runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.reject(new Error("github unreachable")),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: () => undefined,
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      return cursorStore.read("octocat-author");
    });

  it("他人のイベントを外して所有イベントだけを 2 件配信する", ({ mixedBacklogWrittenEventIds }) => {
    expect(mixedBacklogWrittenEventIds).toHaveBeenCalledTimes(2);
  });

  it("最初に配信されるのは最古の所有イベントになる", ({ mixedBacklogWrittenEventIds }) => {
    expect(mixedBacklogWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-1");
  });

  it("次に配信されるのは他人のイベントを飛ばした所有イベントになる", ({
    mixedBacklogWrittenEventIds,
  }) => {
    expect(mixedBacklogWrittenEventIds).toHaveBeenNthCalledWith(2, "delivery-3");
  });

  it("1 件ごとに進んだカーソルは最後の所有イベントを指す", ({ mixedBacklogCursor }) => {
    expect(mixedBacklogCursor).toBe("delivery-3");
  });

  it("Last-Event-ID を優先すると保存カーソルより手前から 2 件配信される", ({
    headerResumedWrittenEventIds,
  }) => {
    expect(headerResumedWrittenEventIds).toHaveBeenCalledTimes(2);
  });

  it("Last-Event-ID の次のイベントが最初に配信される", ({ headerResumedWrittenEventIds }) => {
    expect(headerResumedWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-2");
  });

  it("Last-Event-ID から数えて 2 件目のイベントが次に配信される", ({
    headerResumedWrittenEventIds,
  }) => {
    expect(headerResumedWrittenEventIds).toHaveBeenNthCalledWith(2, "delivery-3");
  });

  it("再開位置のイベントが消えていれば replay window の 1 件だけが配信される", ({
    vanishedResumeWrittenEventIds,
  }) => {
    expect(vanishedResumeWrittenEventIds).toHaveBeenCalledTimes(1);
  });

  it("再開位置のイベントが消えていれば replay window のイベントが配信される", ({
    vanishedResumeWrittenEventIds,
  }) => {
    expect(vanishedResumeWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-recent");
  });

  it("所有者を解決できないイベントで再生が中断され何も配信されない", ({
    unresolvableOwnerWrittenEventIds,
  }) => {
    expect(unresolvableOwnerWrittenEventIds).toHaveBeenCalledTimes(0);
  });

  it("所有者を解決できないイベントではカーソルは進まない", ({ unresolvableOwnerCursor }) => {
    expect(unresolvableOwnerCursor).toBe(null);
  });
});

describe("live 配信", () => {
  const it = test
    .extend("liveDeliveryWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(liveOctocatEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    })
    .extend("liveDeliveryCursor", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: () => undefined,
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(liveOctocatEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return cursorStore.read("octocat-author");
    })
    .extend("replayedLiveIdWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(octocatBacklogEvent);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(replayedOctocatEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    })
    .extend("failingSinkCursor", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: () => {
            throw new Error("socket closed");
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(liveOctocatEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await finished;
      return cursorStore.read("octocat-author");
    })
    .extend("serialLiveWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(firstSerialLiveEvent);
      await eventStore.createIfAbsent(secondSerialLiveEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    });

  it("live の追加イベントは 1 件配信される", ({ liveDeliveryWrittenEventIds }) => {
    expect(liveDeliveryWrittenEventIds).toHaveBeenCalledTimes(1);
  });

  it("配信されるのは live で追加されたイベントになる", ({ liveDeliveryWrittenEventIds }) => {
    expect(liveDeliveryWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-live");
  });

  it("live の追加イベントでカーソルが進む", ({ liveDeliveryCursor }) => {
    expect(liveDeliveryCursor).toBe("delivery-live");
  });

  it("バックログと同一 ID の live イベントを足しても配信は 1 件のままになる", ({
    replayedLiveIdWrittenEventIds,
  }) => {
    expect(replayedLiveIdWrittenEventIds).toHaveBeenCalledTimes(1);
  });

  it("バックログと同一 ID で配信されるのはバックログの 1 件になる", ({
    replayedLiveIdWrittenEventIds,
  }) => {
    expect(replayedLiveIdWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-1");
  });

  it("SSE 書き込み失敗でストリームは停止しカーソルは進まない", ({ failingSinkCursor }) => {
    expect(failingSinkCursor).toBe(null);
  });

  it("続けて届いた live イベントは 2 件とも配信される", ({ serialLiveWrittenEventIds }) => {
    expect(serialLiveWrittenEventIds).toHaveBeenCalledTimes(2);
  });

  it("live 配信の 1 件目は先に到着したイベントになる", ({ serialLiveWrittenEventIds }) => {
    expect(serialLiveWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-live-1");
  });

  it("live 配信の 2 件目は後に到着したイベントになる", ({ serialLiveWrittenEventIds }) => {
    expect(serialLiveWrittenEventIds).toHaveBeenNthCalledWith(2, "delivery-live-2");
  });
});

describe("live watch の開始位置", () => {
  const it = test
    .extend("emptyBacklogLiveWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: "delivery-vanished",
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(liveOctocatEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    })
    .extend("evictingKnownIdWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
        knownIdLimit: 1,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(firstSerialLiveEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(secondSerialLiveEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      return writtenEventIds;
    });

  it("バックログが空で再開位置も消えていれば時刻起点で 1 件購読する", ({
    emptyBacklogLiveWrittenEventIds,
  }) => {
    expect(emptyBacklogLiveWrittenEventIds).toHaveBeenCalledTimes(1);
  });

  it("時刻起点の購読で配信されるのは追加された live イベントになる", ({
    emptyBacklogLiveWrittenEventIds,
  }) => {
    expect(emptyBacklogLiveWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-live");
  });

  it("既知 ID 集合が上限 1 でも 2 件とも配信される", ({ evictingKnownIdWrittenEventIds }) => {
    expect(evictingKnownIdWrittenEventIds).toHaveBeenCalledTimes(2);
  });

  it("既知 ID 集合の上限を超える前の 1 件目が配信される", ({ evictingKnownIdWrittenEventIds }) => {
    expect(evictingKnownIdWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-live-1");
  });

  it("最古の既知 ID が追い出された後の 2 件目も配信される", ({
    evictingKnownIdWrittenEventIds,
  }) => {
    expect(evictingKnownIdWrittenEventIds).toHaveBeenNthCalledWith(2, "delivery-live-2");
  });
});

describe("停止後の抑止", () => {
  const it = test
    .extend("hangupDuringReplayWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      await eventStore.createIfAbsent(octocatBacklogEvent);
      await eventStore.createIfAbsent(middleOctocatBacklogEvent);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      await runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
            clientHangup.abort();
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      return writtenEventIds;
    })
    .extend("lateOwnerResolutionWrittenEventIds", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const writtenEventIds = vi.fn<(eventId: string) => void>();
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve("octocat");
                }, 30);
              }),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: (frame) => {
            writtenEventIds(frame.eventId);
          },
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(slowAuthorlessLiveEvent);
      await eventStore.createIfAbsent(followingOctocatLiveEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return writtenEventIds;
    })
    .extend("lateOwnerResolutionCursor", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () =>
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve("octocat");
                }, 30);
              }),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: () => undefined,
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await eventStore.createIfAbsent(slowAuthorlessLiveEvent);
      await eventStore.createIfAbsent(followingOctocatLiveEvent);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      await finished;
      await new Promise((resolve) => setTimeout(resolve, 100));
      return cursorStore.read("octocat-author");
    });

  it("再生の途中で停止したら配信は 1 件で打ち切られる", ({ hangupDuringReplayWrittenEventIds }) => {
    expect(hangupDuringReplayWrittenEventIds).toHaveBeenCalledTimes(1);
  });

  it("再生の途中で停止するまでに配られるのは先頭のイベントになる", ({
    hangupDuringReplayWrittenEventIds,
  }) => {
    expect(hangupDuringReplayWrittenEventIds).toHaveBeenNthCalledWith(1, "delivery-1");
  });

  it("停止後に完了した所有者判定は書き込まれない", ({ lateOwnerResolutionWrittenEventIds }) => {
    expect(lateOwnerResolutionWrittenEventIds).toHaveBeenCalledTimes(0);
  });

  it("停止後はキューの後続も走らずカーソルは進まない", ({ lateOwnerResolutionCursor }) => {
    expect(lateOwnerResolutionCursor).toBe(null);
  });
});

describe("keepalive と切断", () => {
  const it = test
    .extend("failingKeepaliveWrites", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const writeKeepalive = vi.fn<() => void>(() => {
        throw new Error("socket closed");
      });
      const clientHangup = new AbortController();
      await runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: { writeEvent: () => undefined, writeKeepalive },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
        keepaliveMs: 1,
      });
      return writeKeepalive;
    })
    .extend("hangupTermination", async () => {
      const eventStore = createMemoryEventStore(() => streamStartMs);
      const cursorStore = createMemoryCursorStore(() => streamStartMs);
      const clientHangup = new AbortController();
      const finished = runEventStream({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        lastEventId: null,
        events: eventStore,
        cursors: cursorStore,
        ownerFilter: createOwnerFilter({
          events: eventStore,
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.resolve(null),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }),
        sink: {
          writeEvent: () => undefined,
          writeKeepalive: () => undefined,
        },
        clientAbort: clientHangup.signal,
        log: silentLogger,
        now: () => streamStartMs,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      clientHangup.abort();
      return finished;
    });

  it("keepalive の書き込み失敗でストリームは停止する", ({ failingKeepaliveWrites }) => {
    expect(failingKeepaliveWrites).toHaveBeenCalledTimes(1);
  });

  it("クライアント切断でストリームは終了する", ({ hangupTermination }) => {
    expect(hangupTermination).toBe(undefined);
  });
});

describe("時刻を渡されないストリーム", () => {
  const it = test.extend("clocklessStreamWrittenEventIds", async () => {
    const eventStore = createMemoryEventStore(() => streamStartMs);
    const cursorStore = createMemoryCursorStore(() => streamStartMs);
    const writtenEventIds = vi.fn<(eventId: string) => void>();
    const clientHangup = new AbortController();
    const finished = runEventStream({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      lastEventId: null,
      events: eventStore,
      cursors: cursorStore,
      ownerFilter: createOwnerFilter({
        events: eventStore,
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }),
      sink: {
        writeEvent: (frame) => {
          writtenEventIds(frame.eventId);
        },
        writeKeepalive: () => undefined,
      },
      clientAbort: clientHangup.signal,
      log: silentLogger,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    clientHangup.abort();
    await finished;
    return writtenEventIds;
  });

  it("空の保管庫では何も配信されない", ({ clocklessStreamWrittenEventIds }) => {
    expect(clocklessStreamWrittenEventIds).toHaveBeenCalledTimes(0);
  });
});
