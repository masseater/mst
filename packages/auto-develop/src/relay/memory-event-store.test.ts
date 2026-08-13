import { describe, expect, test, vi } from "vite-plus/test";

import { createMemoryEventStore } from "./memory-event-store.ts";

import type { StoredEvent } from "./store.ts";

const pullPayload = { pull_request: { number: 7 } };

const authoredPayload = { pull_request: { number: 7, user: { login: "octocat" } } };

const storedEventA: StoredEvent = {
  id: "a",
  eventType: "pull_request",
  deliveryId: "a",
  payload: {},
  receivedAtMs: 100,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
};

const storedEventB: StoredEvent = { ...storedEventA, id: "b", deliveryId: "b" };

const storedEventC: StoredEvent = { ...storedEventA, id: "c", deliveryId: "c", receivedAtMs: 50 };

const storedEventD: StoredEvent = { ...storedEventA, id: "d", deliveryId: "d", receivedAtMs: 200 };

const storedEventE: StoredEvent = { ...storedEventA, id: "e", deliveryId: "e", receivedAtMs: 300 };

const replayedEventA: StoredEvent = { ...storedEventA, receivedAtMs: 999 };

const expiredEvent: StoredEvent = {
  ...storedEventA,
  id: "old",
  deliveryId: "old",
  expiresAtMs: 10,
};

const recreatedEvent: StoredEvent = {
  ...storedEventA,
  id: "old",
  deliveryId: "old",
  receivedAtMs: 500,
};

const freshEvent: StoredEvent = { ...storedEventA, id: "new", deliveryId: "new" };

const authoredEvent: StoredEvent = {
  ...storedEventA,
  id: "authored",
  deliveryId: "authored",
  payload: authoredPayload,
};

const prEventA: StoredEvent = { ...storedEventA, id: "p1", deliveryId: "p1", payload: pullPayload };

const prEventB: StoredEvent = {
  ...storedEventA,
  id: "p2",
  deliveryId: "p2",
  receivedAtMs: 200,
  payload: pullPayload,
};

describe("createMemoryEventStore", () => {
  const it = test
    .extend("eventsInReadOrder", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventB);
      await eventStore.createIfAbsent(storedEventA);
      await eventStore.createIfAbsent(storedEventC);
      return eventStore.readSince(0);
    })
    .extend("eventsAcrossInstants", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventA);
      await eventStore.createIfAbsent(storedEventC);
      return eventStore.readSince(0);
    })
    .extend("eventsAtSameInstant", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventB);
      await eventStore.createIfAbsent(storedEventA);
      return eventStore.readSince(0);
    })
    .extend("eventsSinceInstant", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventC);
      await eventStore.createIfAbsent(storedEventA);
      return eventStore.readSince(100);
    })
    .extend("duplicateCreationResponse", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventA);
      return eventStore.createIfAbsent(replayedEventA);
    })
    .extend("duplicateCreationReadOrder", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventA);
      await eventStore.createIfAbsent(replayedEventA);
      return eventStore.readSince(0);
    })
    .extend("eventsAfterReference", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventA);
      await eventStore.createIfAbsent(storedEventD);
      await eventStore.createIfAbsent(storedEventE);
      return eventStore.readAfterId("a");
    })
    .extend("eventsAfterLastReference", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventA);
      await eventStore.createIfAbsent(storedEventD);
      return eventStore.readAfterId("d");
    })
    .extend("eventsAfterMiddleReference", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventC);
      await eventStore.createIfAbsent(storedEventA);
      await eventStore.createIfAbsent(storedEventD);
      return eventStore.readAfterId("a");
    })
    .extend("eventsAfterMissingReference", () => createMemoryEventStore().readAfterId("missing"))
    .extend("eventsAfterExpiry", async () => {
      const stampedNow = vi.fn<() => number>().mockReturnValueOnce(0).mockReturnValue(11);
      const eventStore = createMemoryEventStore(stampedNow);
      await eventStore.createIfAbsent(expiredEvent);
      return eventStore.readSince(0);
    })
    .extend("eventsAfterExpiredReference", async () => {
      const stampedNow = vi.fn<() => number>().mockReturnValueOnce(0).mockReturnValue(11);
      const eventStore = createMemoryEventStore(stampedNow);
      await eventStore.createIfAbsent(expiredEvent);
      return eventStore.readAfterId("old");
    })
    .extend("eventsAfterRecreation", async () => {
      const stampedNow = vi.fn<() => number>().mockReturnValueOnce(0).mockReturnValue(11);
      const eventStore = createMemoryEventStore(stampedNow);
      await eventStore.createIfAbsent(expiredEvent);
      await eventStore.createIfAbsent(freshEvent);
      await eventStore.createIfAbsent(recreatedEvent);
      return eventStore.readSince(0);
    })
    .extend("missingReferenceSubscription", () =>
      createMemoryEventStore().subscribeAfterId({
        eventId: "missing",
        onAdd: vi.fn<(added: StoredEvent) => void>(),
      }),
    )
    .extend("afterIdListener", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventA);
      const onAdd = vi.fn<(added: StoredEvent) => void>();
      const subscription = eventStore.subscribeAfterId({ eventId: "a", onAdd });
      await eventStore.createIfAbsent(storedEventD);
      await eventStore.createIfAbsent(storedEventC);
      subscription?.unsubscribe();
      await eventStore.createIfAbsent(storedEventE);
      return onAdd;
    })
    .extend("sameInstantListener", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(storedEventA);
      const onAdd = vi.fn<(added: StoredEvent) => void>();
      const subscription = eventStore.subscribeAfterId({ eventId: "a", onAdd });
      await eventStore.createIfAbsent(storedEventB);
      subscription?.unsubscribe();
      return onAdd;
    })
    .extend("sinceListener", async () => {
      const eventStore = createMemoryEventStore();
      const onAdd = vi.fn<(added: StoredEvent) => void>();
      const subscription = eventStore.subscribeSince({ sinceMs: 150, onAdd });
      await eventStore.createIfAbsent(storedEventA);
      await eventStore.createIfAbsent(storedEventD);
      subscription.unsubscribe();
      await eventStore.createIfAbsent(storedEventE);
      return onAdd;
    })
    .extend("latestAuthoredEvent", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(authoredEvent);
      await eventStore.createIfAbsent(prEventB);
      return eventStore.findAuthorEvent(7);
    })
    .extend("authoredEventBeyondWindow", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(authoredEvent);
      for (const offset of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
        await eventStore.createIfAbsent({
          ...storedEventA,
          id: `pull-${offset}`,
          deliveryId: `pull-${offset}`,
          receivedAtMs: 100 + offset,
          payload: pullPayload,
        });
      }
      return eventStore.findAuthorEvent(7);
    })
    .extend("deletionCount", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(prEventA);
      await eventStore.createIfAbsent(prEventB);
      await eventStore.createIfAbsent(storedEventE);
      return eventStore.deleteForPr({ prNumber: 7, excludeDeliveryId: "p2" });
    })
    .extend("eventsAfterDeletion", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(prEventA);
      await eventStore.createIfAbsent(prEventB);
      await eventStore.createIfAbsent(storedEventE);
      await eventStore.deleteForPr({ prNumber: 7, excludeDeliveryId: "p2" });
      return eventStore.readSince(0);
    })
    .extend("unfilteredDeletionCount", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(prEventA);
      await eventStore.createIfAbsent(prEventB);
      await eventStore.createIfAbsent(storedEventE);
      return eventStore.deleteForPr({ prNumber: 7, excludeDeliveryId: "none" });
    })
    .extend("eventsAfterUnfilteredDeletion", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent(prEventA);
      await eventStore.createIfAbsent(prEventB);
      await eventStore.createIfAbsent(storedEventE);
      await eventStore.deleteForPr({ prNumber: 7, excludeDeliveryId: "none" });
      return eventStore.readSince(0);
    });

  it("保存したイベントは受信時刻と ID の昇順で読み出される", ({ eventsInReadOrder }) => {
    expect(eventsInReadOrder).toStrictEqual([storedEventC, storedEventA, storedEventB]);
  });

  it("受信時刻が早いイベントが先に読み出される", ({ eventsAcrossInstants }) => {
    expect(eventsAcrossInstants).toStrictEqual([storedEventC, storedEventA]);
  });

  it("同時刻のイベントは ID の昇順で読み出される", ({ eventsAtSameInstant }) => {
    expect(eventsAtSameInstant).toStrictEqual([storedEventA, storedEventB]);
  });

  it("readSince は起点時刻より前のイベントを外す", ({ eventsSinceInstant }) => {
    expect(eventsSinceInstant).toStrictEqual([storedEventA]);
  });

  it("同じ delivery ID の 2 回目は元の保存済みイベントを返す", ({ duplicateCreationResponse }) => {
    expect(duplicateCreationResponse).toStrictEqual(storedEventA);
  });

  it("同じ delivery ID の 2 回目でも保存されるのは最初の 1 件だけになる", ({
    duplicateCreationReadOrder,
  }) => {
    expect(duplicateCreationReadOrder).toStrictEqual([storedEventA]);
  });

  it("readAfterId は参照イベントより後のイベントを昇順で返す", ({ eventsAfterReference }) => {
    expect(eventsAfterReference).toStrictEqual([storedEventD, storedEventE]);
  });

  it("readAfterId は参照イベントが最後なら空になる", ({ eventsAfterLastReference }) => {
    expect(eventsAfterLastReference).toStrictEqual([]);
  });

  it("readAfterId は参照イベントより前のイベントを外す", ({ eventsAfterMiddleReference }) => {
    expect(eventsAfterMiddleReference).toStrictEqual([storedEventD]);
  });

  it("readAfterId は参照イベント不在なら null を返す", ({ eventsAfterMissingReference }) => {
    expect(eventsAfterMissingReference).toBe(null);
  });

  it("期限切れイベントは読み出しから消える", ({ eventsAfterExpiry }) => {
    expect(eventsAfterExpiry).toStrictEqual([]);
  });

  it("期限切れの参照イベントからの readAfterId は null になる", ({
    eventsAfterExpiredReference,
  }) => {
    expect(eventsAfterExpiredReference).toBe(null);
  });

  it("期限切れイベントは次の保存時に間引かれ、同じ ID の再保存が新規になる", ({
    eventsAfterRecreation,
  }) => {
    expect(eventsAfterRecreation).toStrictEqual([freshEvent, recreatedEvent]);
  });

  it("subscribeAfterId は参照不在なら null を返す", ({ missingReferenceSubscription }) => {
    expect(missingReferenceSubscription).toBe(null);
  });

  it("subscribeAfterId は参照より後の追加だけを 1 度通知する", ({ afterIdListener }) => {
    expect(afterIdListener).toHaveBeenCalledOnce();
  });

  it("subscribeAfterId が通知するのは参照より後のイベントになる", ({ afterIdListener }) => {
    expect(afterIdListener).toHaveBeenCalledWith(storedEventD);
  });

  it("同時刻の追加は 1 度だけ通知される", ({ sameInstantListener }) => {
    expect(sameInstantListener).toHaveBeenCalledOnce();
  });

  it("同時刻の追加は ID の並びで参照より後と判定される", ({ sameInstantListener }) => {
    expect(sameInstantListener).toHaveBeenCalledWith(storedEventB);
  });

  it("subscribeSince は起点時刻以降の追加だけを 1 度通知する", ({ sinceListener }) => {
    expect(sinceListener).toHaveBeenCalledOnce();
  });

  it("subscribeSince が通知するのは起点時刻以降のイベントになる", ({ sinceListener }) => {
    expect(sinceListener).toHaveBeenCalledWith(storedEventD);
  });

  it("findAuthorEvent は作者入りの最新イベントを返す", ({ latestAuthoredEvent }) => {
    expect(latestAuthoredEvent).toStrictEqual(authoredEvent);
  });

  it("findAuthorEvent は直近 10 件より古い作者入りイベントを見ない", ({
    authoredEventBeyondWindow,
  }) => {
    expect(authoredEventBeyondWindow).toBe(null);
  });

  it("deleteForPr は除外配送 ID 以外の対象 PR イベントを消した件数を返す", ({ deletionCount }) => {
    expect(deletionCount).toBe(1);
  });

  it("deleteForPr は除外した配送 ID と対象外の PR のイベントを残す", ({ eventsAfterDeletion }) => {
    expect(eventsAfterDeletion).toStrictEqual([prEventB, storedEventE]);
  });

  it("deleteForPr は除外が当たらなければ対象 PR のイベントをすべて消す", ({
    unfilteredDeletionCount,
  }) => {
    expect(unfilteredDeletionCount).toBe(2);
  });

  it("deleteForPr は対象 PR 以外のイベントを残す", ({ eventsAfterUnfilteredDeletion }) => {
    expect(eventsAfterUnfilteredDeletion).toStrictEqual([storedEventE]);
  });
});
