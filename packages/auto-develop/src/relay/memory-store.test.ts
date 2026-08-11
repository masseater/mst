import { describe, expect, test, vi } from "vite-plus/test";

import {
  createMemoryCursorStore,
  createMemoryEventStore,
  createMemorySessionStore,
} from "./memory-store.ts";

import type { StoredEvent } from "./store.ts";

const storedEvent = (id: string, shape: Partial<Omit<StoredEvent, "id">> = {}): StoredEvent => ({
  id,
  eventType: "pull_request",
  deliveryId: id,
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

describe("createMemoryEventStore", () => {
  test("保存したイベントが受信時刻昇順かつ同時刻ならID昇順で読める", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(storedEvent("delivery-b", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-a", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-c", { receivedAtMs: 50 }));
    const eventIds = (await eventStore.readSince(0)).map((stored) => stored.id);
    expect(eventIds).toStrictEqual(["delivery-c", "delivery-a", "delivery-b"]);
  });

  test("同じ delivery ID の 2 回目は元の保存済みイベントを返す", async () => {
    const eventStore = createMemoryEventStore();
    const original = await eventStore.createIfAbsent(storedEvent("delivery-1"));
    const replayed = await eventStore.createIfAbsent(
      storedEvent("delivery-1", { receivedAtMs: 999 }),
    );
    expect([replayed, (await eventStore.readSince(0)).length]).toStrictEqual([original, 1]);
  });

  test("readAfterId は参照イベントより後だけを返す", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(storedEvent("delivery-1", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-2", { receivedAtMs: 200 }));
    await eventStore.createIfAbsent(storedEvent("delivery-3", { receivedAtMs: 300 }));
    const followingIds = (await eventStore.readAfterId("delivery-1"))?.map((stored) => stored.id);
    expect(followingIds).toStrictEqual(["delivery-2", "delivery-3"]);
  });

  test("readAfterId は参照イベント不在なら null を返す", async () => {
    const eventStore = createMemoryEventStore();
    expect(await eventStore.readAfterId("delivery-missing")).toStrictEqual(null);
  });

  test("期限切れイベントは読み出しから消える", async () => {
    const clock = manualClock(0);
    const eventStore = createMemoryEventStore(clock.now);
    await eventStore.createIfAbsent(storedEvent("delivery-old", { expiresAtMs: 10 }));
    clock.advanceTo(11);
    expect(await eventStore.readSince(0)).toStrictEqual([]);
  });

  test("期限切れの参照イベントからの readAfterId は null になる", async () => {
    const clock = manualClock(0);
    const eventStore = createMemoryEventStore(clock.now);
    await eventStore.createIfAbsent(storedEvent("delivery-old", { expiresAtMs: 10 }));
    clock.advanceTo(11);
    expect(await eventStore.readAfterId("delivery-old")).toStrictEqual(null);
  });

  test("期限切れイベントは次の保存時に間引かれ、同じ ID の再保存が新規になる", async () => {
    const clock = manualClock(0);
    const eventStore = createMemoryEventStore(clock.now);
    await eventStore.createIfAbsent(storedEvent("delivery-old", { expiresAtMs: 10 }));
    clock.advanceTo(11);
    await eventStore.createIfAbsent(storedEvent("delivery-new"));
    const recreated = await eventStore.createIfAbsent(
      storedEvent("delivery-old", { receivedAtMs: 500 }),
    );
    expect(recreated.receivedAtMs).toStrictEqual(500);
  });

  test("subscribeAfterId は参照不在なら null、以後の追加だけを通知する", async () => {
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
    const notifiedIds = onAdd.mock.calls.map(([added]) => added.id);
    expect([missingSubscription, notifiedIds]).toStrictEqual([null, ["delivery-next"]]);
  });

  test("同時刻の追加は ID の並びで参照より後と判定される", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(storedEvent("delivery-a", { receivedAtMs: 100 }));
    const onAdd = vi.fn<(added: StoredEvent) => void>();
    const subscription = eventStore.subscribeAfterId({ eventId: "delivery-a", onAdd });
    await eventStore.createIfAbsent(storedEvent("delivery-b", { receivedAtMs: 100 }));
    subscription?.unsubscribe();
    expect(onAdd.mock.calls.map(([added]) => added.id)).toStrictEqual(["delivery-b"]);
  });

  test("subscribeSince は起点時刻以降の追加だけを通知する", async () => {
    const eventStore = createMemoryEventStore();
    const onAdd = vi.fn<(added: StoredEvent) => void>();
    const subscription = eventStore.subscribeSince({ sinceMs: 150, onAdd });
    await eventStore.createIfAbsent(storedEvent("delivery-early", { receivedAtMs: 100 }));
    await eventStore.createIfAbsent(storedEvent("delivery-late", { receivedAtMs: 200 }));
    subscription.unsubscribe();
    await eventStore.createIfAbsent(storedEvent("delivery-after-stop", { receivedAtMs: 300 }));
    expect(onAdd.mock.calls.map(([added]) => added.id)).toStrictEqual(["delivery-late"]);
  });

  test("findAuthorEvent は作者入りの最新イベントを返す", async () => {
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
    expect((await eventStore.findAuthorEvent(7))?.id).toStrictEqual("delivery-1");
  });

  test("findAuthorEvent は直近 10 件より古い作者入りイベントを見ない", async () => {
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
    expect(await eventStore.findAuthorEvent(7)).toStrictEqual(null);
  });

  test("deleteForPr は除外配送 ID 以外の対象 PR イベントを消して件数を返す", async () => {
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
    const remainingIds = (await eventStore.readSince(0)).map((stored) => stored.id);
    expect([deletedCount, remainingIds]).toStrictEqual([1, ["delivery-2", "delivery-3"]]);
  });
});

describe("createMemoryCursorStore", () => {
  test("書いたカーソルが読める", async () => {
    const cursorStore = createMemoryCursorStore();
    await cursorStore.write({ clientId: "octocat-author", eventId: "delivery-1" });
    expect(await cursorStore.read("octocat-author")).toStrictEqual("delivery-1");
  });

  test("不在のカーソルは null になる", async () => {
    const cursorStore = createMemoryCursorStore();
    expect(await cursorStore.read("octocat-author")).toStrictEqual(null);
  });

  test("48 時間の期限が切れたカーソルは null になる", async () => {
    const clock = manualClock(0);
    const cursorStore = createMemoryCursorStore(clock.now);
    await cursorStore.write({ clientId: "octocat-author", eventId: "delivery-1" });
    clock.advanceTo(48 * 60 * 60 * 1000);
    expect(await cursorStore.read("octocat-author")).toStrictEqual(null);
  });
});

describe("createMemorySessionStore", () => {
  test("保存したセッションが digest で解決できる", async () => {
    const sessionStore = createMemorySessionStore();
    await sessionStore.save({ digest: "digest-1", login: "octocat", expiresAtMs: 2_000_000 });
    expect(await sessionStore.resolve("digest-1")).toStrictEqual({
      login: "octocat",
      expiresAtMs: 2_000_000,
    });
  });

  test("不在の digest は null になる", async () => {
    const sessionStore = createMemorySessionStore();
    expect(await sessionStore.resolve("digest-missing")).toStrictEqual(null);
  });
});
