import { describe, expect, test } from "vite-plus/test";

import { createMemoryCursorStore } from "./memory-cursor-store.ts";
import { createMemoryEventStore } from "./memory-event-store.ts";
import { createOwnerFilter } from "./owner-filter.ts";
import { runPoll } from "./poll.ts";

describe("runPoll", () => {
  const it = test
    .extend("pollFromCursor", async () => {
      const eventStore = createMemoryEventStore();
      const cursors = createMemoryCursorStore();
      await eventStore.createIfAbsent({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await eventStore.createIfAbsent({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 200,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await eventStore.createIfAbsent({
        id: "delivery-3",
        eventType: "pull_request",
        deliveryId: "delivery-3",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
        receivedAtMs: 300,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
      return runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors,
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
      });
    })
    .extend("cursorAfterPollFromCursor", async () => {
      const eventStore = createMemoryEventStore();
      const cursors = createMemoryCursorStore();
      await eventStore.createIfAbsent({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await eventStore.createIfAbsent({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 200,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await eventStore.createIfAbsent({
        id: "delivery-3",
        eventType: "pull_request",
        deliveryId: "delivery-3",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
        receivedAtMs: 300,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
      await runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors,
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
      });
      return cursors.read("octocat-author");
    })
    .extend("pollWithoutCursor", async () => {
      const eventStore = createMemoryEventStore();
      await eventStore.createIfAbsent({
        id: "delivery-recent",
        eventType: "pull_request",
        deliveryId: "delivery-recent",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: Date.now() - 1000,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors: createMemoryCursorStore(),
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
      });
    })
    .extend("pollFromVanishedCursor", async () => {
      const eventStore = createMemoryEventStore();
      const cursors = createMemoryCursorStore();
      await cursors.write({ clientId: "octocat-author", eventId: "delivery-vanished" });
      await eventStore.createIfAbsent({
        id: "delivery-recent",
        eventType: "pull_request",
        deliveryId: "delivery-recent",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: Date.now() - 1000,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors,
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
      });
    })
    .extend("pollWithNothingFollowing", async () => {
      const eventStore = createMemoryEventStore();
      const cursors = createMemoryCursorStore();
      await eventStore.createIfAbsent({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
      return runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors,
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
      });
    })
    .extend("cursorAfterPollWithNothingFollowing", async () => {
      const eventStore = createMemoryEventStore();
      const cursors = createMemoryCursorStore();
      await eventStore.createIfAbsent({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
      await runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors,
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
      });
      return cursors.read("octocat-author");
    })
    .extend("pollOverForeignEventsOnly", async () => {
      const eventStore = createMemoryEventStore();
      const cursors = createMemoryCursorStore();
      await eventStore.createIfAbsent({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await eventStore.createIfAbsent({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
        receivedAtMs: 200,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
      return runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors,
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
      });
    })
    .extend("cursorAfterPollOverForeignEventsOnly", async () => {
      const eventStore = createMemoryEventStore();
      const cursors = createMemoryCursorStore();
      await eventStore.createIfAbsent({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await eventStore.createIfAbsent({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
        receivedAtMs: 200,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
      await runPoll({
        clientId: "octocat-author",
        subscriberLogin: "octocat",
        events: eventStore,
        cursors,
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
      });
      return cursors.read("octocat-author");
    })
    .extend("pollForSecondOperator", async () => {
      const eventStore = createMemoryEventStore();
      const pollStartedAtMs = Date.now();
      await eventStore.createIfAbsent({
        id: "delivery-octocat",
        eventType: "pull_request",
        deliveryId: "delivery-octocat",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: pollStartedAtMs - 2000,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await eventStore.createIfAbsent({
        id: "delivery-hubot",
        eventType: "pull_request",
        deliveryId: "delivery-hubot",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
        receivedAtMs: pollStartedAtMs - 1000,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return runPoll({
        clientId: "hubot-author",
        subscriberLogin: "hubot",
        events: eventStore,
        cursors: createMemoryCursorStore(),
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
      });
    });

  it("カーソル以降の所有イベントが 1 件だけエンベロープで返る", ({ pollFromCursor }) => {
    expect(pollFromCursor).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-2",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      },
    ]);
  });

  it("カーソル以降の所有イベントがエンベロープで返る", ({ pollFromCursor }) => {
    expect(pollFromCursor).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-2",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      },
    ]);
  });

  it("カーソルは所有外を含む走査末尾へ進む", ({ cursorAfterPollFromCursor }) => {
    expect(cursorAfterPollFromCursor).toStrictEqual("delivery-3");
  });

  it("カーソルなしは replay window から 1 件取得する", ({ pollWithoutCursor }) => {
    expect(pollWithoutCursor).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-recent",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      },
    ]);
  });

  it("カーソルなしは replay window から取得する", ({ pollWithoutCursor }) => {
    expect(pollWithoutCursor).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-recent",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      },
    ]);
  });

  it("カーソルイベントが TTL で消えていたら 1 件にフォールバックする", ({
    pollFromVanishedCursor,
  }) => {
    expect(pollFromVanishedCursor).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-recent",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      },
    ]);
  });

  it("カーソルイベントが TTL で消えていたら replay window にフォールバックする", ({
    pollFromVanishedCursor,
  }) => {
    expect(pollFromVanishedCursor).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-recent",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      },
    ]);
  });

  it("後続 0 件なら空配列になる", ({ pollWithNothingFollowing }) => {
    expect(pollWithNothingFollowing).toStrictEqual([]);
  });

  it("後続 0 件ならカーソルは進まない", ({ cursorAfterPollWithNothingFollowing }) => {
    expect(cursorAfterPollWithNothingFollowing).toStrictEqual("delivery-1");
  });

  it("所有外イベントしか無ければ空配列になる", ({ pollOverForeignEventsOnly }) => {
    expect(pollOverForeignEventsOnly).toStrictEqual([]);
  });

  it("所有外イベントしか無くてもカーソルは走査末尾へ進む", ({
    cursorAfterPollOverForeignEventsOnly,
  }) => {
    expect(cursorAfterPollOverForeignEventsOnly).toStrictEqual("delivery-2");
  });

  it("2 operator のイベントが混在しても所有分だけ 1 件返る", ({ pollForSecondOperator }) => {
    expect(pollForSecondOperator).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-hubot",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
      },
    ]);
  });

  it("2 operator のイベントが混在してもそれぞれの所有分だけ返る", ({ pollForSecondOperator }) => {
    expect(pollForSecondOperator).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "delivery-hubot",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "hubot" } } },
      },
    ]);
  });
});
