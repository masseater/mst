import { describe, expect, test, vi } from "vite-plus/test";

import {
  createMemoryCursorStore,
  createMemoryEventStore,
  createMemorySessionStore,
} from "./memory-store.ts";

import type { StoredEvent } from "./store.ts";

const storedEvent = (
  identity: string,
  shape: Partial<Omit<StoredEvent, "identity">> = {},
): StoredEvent => ({
  id: identity,
  eventType: "pull_request",
  deliveryId: identity,
  payload: {},
  receivedAtMs: 100,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
  ...shape,
});

const manualClock = (
  startMs: number,
): { readonly now: () => number; readonly advanceTo: (ms: number) => void } => {
  const frames = new Map([["currentMs", startMs]]);
  return {
    now: () => frames.get("currentMs") ?? 0,
    advanceTo: (ms) => {
      frames.set("currentMs", ms);
    },
  };
};

const it = test
  .extend("eventsInReadOrder", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(storedEvent("delivery-b", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-a", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-c", { receivedAtMs: 50 }));
    return eventStore.readSince(0);
  })
  .extend("duplicateDeliveryCreation", async () => {
    const eventStore = createMemoryEventStore();
    const original = await eventStore.createIfAbsent(storedEvent("delivery-1"));
    const replayed = await eventStore.createIfAbsent(
      storedEvent("delivery-1", { receivedAtMs: 999 }),
    );
    const storedEvents = await eventStore.readSince(0);
    return { original, replayed, storedEvents };
  })
  .extend("eventsAfterFirstDelivery", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(storedEvent("delivery-1", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-2", { receivedAtMs: 200 }));
    await eventStore.createIfAbsent(storedEvent("delivery-3", { receivedAtMs: 300 }));
    return eventStore.readAfterId("delivery-1");
  })
  .extend("eventsAfterMissingDelivery", () =>
    createMemoryEventStore().readAfterId("delivery-missing"),
  )
  .extend("eventsAfterExpiry", async () => {
    const clock = manualClock(0);
    const eventStore = createMemoryEventStore(clock.now);
    await eventStore.createIfAbsent(storedEvent("delivery-old", { expiresAtMs: 10 }));
    clock.advanceTo(11);
    return eventStore.readSince(0);
  })
  .extend("eventsAfterExpiredReference", async () => {
    const clock = manualClock(0);
    const eventStore = createMemoryEventStore(clock.now);
    await eventStore.createIfAbsent(storedEvent("delivery-old", { expiresAtMs: 10 }));
    clock.advanceTo(11);
    return eventStore.readAfterId("delivery-old");
  })
  .extend("recreatedExpiredEvent", async () => {
    const clock = manualClock(0);
    const eventStore = createMemoryEventStore(clock.now);
    await eventStore.createIfAbsent(storedEvent("delivery-old", { expiresAtMs: 10 }));
    clock.advanceTo(11);
    await eventStore.createIfAbsent(storedEvent("delivery-new"));
    return eventStore.createIfAbsent(storedEvent("delivery-old", { receivedAtMs: 500 }));
  })
  .extend("subscriptionAfterReference", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(storedEvent("delivery-ref", { receivedAtMs: 100 }));
    const onAdd = vi.fn<(added: StoredEvent) => void>();
    const missingSubscription = eventStore.subscribeAfterId({
      eventId: "delivery-missing",
      onAdd: vi.fn<(added: StoredEvent) => void>(),
    });
    const subscription = eventStore.subscribeAfterId({ eventId: "delivery-ref", onAdd });
    await eventStore.createIfAbsent(storedEvent("delivery-next", { receivedAtMs: 200 }));
    await eventStore.createIfAbsent(storedEvent("delivery-before", { receivedAtMs: 50 }));
    subscription?.unsubscribe();
    await eventStore.createIfAbsent(storedEvent("delivery-after-stop", { receivedAtMs: 300 }));
    return { missingSubscription, onAdd };
  })
  .extend("sameInstantSubscriptionSpy", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(storedEvent("delivery-a", { receivedAtMs: 100 }));
    const onAdd = vi.fn<(added: StoredEvent) => void>();
    const subscription = eventStore.subscribeAfterId({ eventId: "delivery-a", onAdd });
    await eventStore.createIfAbsent(storedEvent("delivery-b", { receivedAtMs: 100 }));
    subscription?.unsubscribe();
    return onAdd;
  })
  .extend("subscribeSinceSpy", async () => {
    const eventStore = createMemoryEventStore();
    const onAdd = vi.fn<(added: StoredEvent) => void>();
    const subscription = eventStore.subscribeSince({ sinceMs: 150, onAdd });
    await eventStore.createIfAbsent(storedEvent("delivery-early", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-late", { receivedAtMs: 200 }));
    subscription.unsubscribe();
    await eventStore.createIfAbsent(storedEvent("delivery-after-stop", { receivedAtMs: 300 }));
    return onAdd;
  })
  .extend("latestAuthoredEvent", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(
      storedEvent("delivery-1", {
        receivedAtMs: 100,
        payload: { pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    await eventStore.createIfAbsent(
      storedEvent("delivery-2", { receivedAtMs: 200, payload: { pull_request: { number: 7 } } }),
    );
    return eventStore.findAuthorEvent(7);
  })
  .extend("authoredEventBeyondWindow", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(
      storedEvent("delivery-authored", {
        receivedAtMs: 100,
        payload: { pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    for (const offset of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      await eventStore.createIfAbsent(
        storedEvent(`delivery-${offset}`, {
          receivedAtMs: 100 + offset,
          payload: { pull_request: { number: 7 } },
        }),
      );
    }
    return eventStore.findAuthorEvent(7);
  })
  .extend("prDeletion", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(
      storedEvent("delivery-1", { receivedAtMs: 100, payload: { pull_request: { number: 7 } } }),
    );
    await eventStore.createIfAbsent(
      storedEvent("delivery-2", { receivedAtMs: 200, payload: { pull_request: { number: 7 } } }),
    );
    await eventStore.createIfAbsent(
      storedEvent("delivery-3", { receivedAtMs: 300, payload: { action: "completed" } }),
    );
    const deletedCount = await eventStore.deleteForPr({
      prNumber: 7,
      excludeDeliveryId: "delivery-2",
    });
    const remainingEvents = await eventStore.readSince(0);
    return { deletedCount, remainingEvents };
  })
  .extend("cursorAfterWrite", async () => {
    const cursorStore = createMemoryCursorStore();
    await cursorStore.write({ clientId: "octocat-author", eventId: "delivery-1" });
    return cursorStore.read("octocat-author");
  })
  .extend("cursorNeverWritten", () => createMemoryCursorStore().read("octocat-author"))
  .extend("cursorAfterExpiry", async () => {
    const clock = manualClock(0);
    const cursorStore = createMemoryCursorStore(clock.now);
    await cursorStore.write({ clientId: "octocat-author", eventId: "delivery-1" });
    clock.advanceTo(48 * 60 * 60 * 1000);
    return cursorStore.read("octocat-author");
  })
  .extend("sessionAfterSave", async () => {
    const sessionStore = createMemorySessionStore();
    await sessionStore.save({ digest: "digest-1", login: "octocat", expiresAtMs: 2_000_000 });
    return sessionStore.resolve("digest-1");
  })
  .extend("sessionForMissingDigest", () => createMemorySessionStore().resolve("digest-missing"));

describe("createMemoryEventStore", () => {
  it("保存したイベントは 3 件とも読める", ({ eventsInReadOrder }) => {
    expect(eventsInReadOrder.length).toStrictEqual(3);
  });

  it("受信時刻が最も早いイベントが先頭に来る", ({ eventsInReadOrder }) => {
    expect(eventsInReadOrder[0]?.id).toStrictEqual("delivery-c");
  });

  it("同時刻のイベントは ID 昇順で 2 番目に来る", ({ eventsInReadOrder }) => {
    expect(eventsInReadOrder[1]?.id).toStrictEqual("delivery-a");
  });

  it("同時刻のイベントは ID 昇順で 3 番目に来る", ({ eventsInReadOrder }) => {
    expect(eventsInReadOrder[2]?.id).toStrictEqual("delivery-b");
  });

  it("同じ delivery ID の 2 回目は元の保存済みイベントを返す", ({ duplicateDeliveryCreation }) => {
    expect(duplicateDeliveryCreation.replayed).toStrictEqual(duplicateDeliveryCreation.original);
  });

  it("同じ delivery ID の 2 回目でも保存件数は 1 件のまま", ({ duplicateDeliveryCreation }) => {
    expect(duplicateDeliveryCreation.storedEvents.length).toStrictEqual(1);
  });

  it("readAfterId は参照イベントより後の 2 件を返す", ({ eventsAfterFirstDelivery }) => {
    expect(eventsAfterFirstDelivery?.length).toStrictEqual(2);
  });

  it("readAfterId が返す先頭は参照イベントの次になる", ({ eventsAfterFirstDelivery }) => {
    expect(eventsAfterFirstDelivery?.[0]?.id).toStrictEqual("delivery-2");
  });

  it("readAfterId が返す末尾は最後のイベントになる", ({ eventsAfterFirstDelivery }) => {
    expect(eventsAfterFirstDelivery?.[1]?.id).toStrictEqual("delivery-3");
  });

  it("readAfterId は参照イベント不在なら null を返す", ({ eventsAfterMissingDelivery }) => {
    expect(eventsAfterMissingDelivery).toStrictEqual(null);
  });

  it("期限切れイベントは読み出しから消える", ({ eventsAfterExpiry }) => {
    expect(eventsAfterExpiry).toStrictEqual([]);
  });

  it("期限切れの参照イベントからの readAfterId は null になる", ({
    eventsAfterExpiredReference,
  }) => {
    expect(eventsAfterExpiredReference).toStrictEqual(null);
  });

  it("期限切れイベントは次の保存時に間引かれ、同じ ID の再保存が新規になる", ({
    recreatedExpiredEvent,
  }) => {
    expect(recreatedExpiredEvent.receivedAtMs).toStrictEqual(500);
  });

  it("subscribeAfterId は参照不在なら null を返す", ({ subscriptionAfterReference }) => {
    expect(subscriptionAfterReference.missingSubscription).toStrictEqual(null);
  });

  it("subscribeAfterId は参照より後の追加だけを 1 度通知する", ({ subscriptionAfterReference }) => {
    expect(subscriptionAfterReference.onAdd.mock.calls.length).toStrictEqual(1);
  });

  it("subscribeAfterId が通知するのは参照より後のイベントになる", ({
    subscriptionAfterReference,
  }) => {
    expect(subscriptionAfterReference.onAdd.mock.calls[0]?.[0].id).toStrictEqual("delivery-next");
  });

  it("同時刻の追加は 1 度だけ通知される", ({ sameInstantSubscriptionSpy }) => {
    expect(sameInstantSubscriptionSpy.mock.calls.length).toStrictEqual(1);
  });

  it("同時刻の追加は ID の並びで参照より後と判定される", ({ sameInstantSubscriptionSpy }) => {
    expect(sameInstantSubscriptionSpy.mock.calls[0]?.[0].id).toStrictEqual("delivery-b");
  });

  it("subscribeSince は起点時刻以降の追加だけを 1 度通知する", ({ subscribeSinceSpy }) => {
    expect(subscribeSinceSpy.mock.calls.length).toStrictEqual(1);
  });

  it("subscribeSince が通知するのは起点時刻以降のイベントになる", ({ subscribeSinceSpy }) => {
    expect(subscribeSinceSpy.mock.calls[0]?.[0].id).toStrictEqual("delivery-late");
  });

  it("findAuthorEvent は作者入りの最新イベントを返す", ({ latestAuthoredEvent }) => {
    expect(latestAuthoredEvent?.id).toStrictEqual("delivery-1");
  });

  it("findAuthorEvent は直近 10 件より古い作者入りイベントを見ない", ({
    authoredEventBeyondWindow,
  }) => {
    expect(authoredEventBeyondWindow).toStrictEqual(null);
  });

  it("deleteForPr は除外配送 ID 以外の対象 PR イベントを消して件数を返す", ({ prDeletion }) => {
    expect(prDeletion.deletedCount).toStrictEqual(1);
  });

  it("deleteForPr の後は 2 件が残る", ({ prDeletion }) => {
    expect(prDeletion.remainingEvents.length).toStrictEqual(2);
  });

  it("deleteForPr は除外した配送 ID を残す", ({ prDeletion }) => {
    expect(prDeletion.remainingEvents[0]?.id).toStrictEqual("delivery-2");
  });

  it("deleteForPr は対象 PR 以外のイベントを残す", ({ prDeletion }) => {
    expect(prDeletion.remainingEvents[1]?.id).toStrictEqual("delivery-3");
  });
});

describe("createMemoryCursorStore", () => {
  it("書いたカーソルが読める", ({ cursorAfterWrite }) => {
    expect(cursorAfterWrite).toStrictEqual("delivery-1");
  });

  it("不在のカーソルは null になる", ({ cursorNeverWritten }) => {
    expect(cursorNeverWritten).toStrictEqual(null);
  });

  it("48 時間の期限が切れたカーソルは null になる", ({ cursorAfterExpiry }) => {
    expect(cursorAfterExpiry).toStrictEqual(null);
  });
});

describe("createMemorySessionStore", () => {
  it("保存したセッションが digest で解決できる", ({ sessionAfterSave }) => {
    expect(sessionAfterSave).toStrictEqual({ login: "octocat", expiresAtMs: 2_000_000 });
  });

  it("不在の digest は null になる", ({ sessionForMissingDigest }) => {
    expect(sessionForMissingDigest).toStrictEqual(null);
  });
});
