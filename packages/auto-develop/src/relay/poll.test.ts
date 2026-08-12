import { describe, expect, test } from "vite-plus/test";

import { createMemoryCursorStore, createMemoryEventStore } from "./memory-store.ts";
import { createOwnerFilter } from "./owner-filter.ts";
import { runPoll } from "./poll.ts";

import type { GithubReader } from "./github-reader.ts";
import type { StoredEvent } from "./store.ts";

const stubGithub: GithubReader = {
  resolveTokenLogin: () => Promise.resolve("octocat"),
  readRepositoryPrivacy: () => Promise.resolve(true),
  listOpenPullRequests: () => Promise.resolve([]),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve([]),
};

const authoredEvent = (
  id: string,
  shape: { readonly receivedAtMs: number; readonly authorLogin?: string },
): StoredEvent => ({
  id,
  eventType: "pull_request",
  deliveryId: id,
  payload: {
    action: "opened",
    pull_request: { number: 7, user: { login: shape.authorLogin ?? "octocat" } },
  },
  receivedAtMs: shape.receivedAtMs,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
});

const it = test
  .extend("pollFromCursor", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: 100 }));
    await events.createIfAbsent(authoredEvent("delivery-2", { receivedAtMs: 200 }));
    await events.createIfAbsent(
      authoredEvent("delivery-3", { receivedAtMs: 300, authorLogin: "hubot" }),
    );
    await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
    const envelopes = await runPoll({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
    const cursorAfterPoll = await cursors.read("octocat-author");
    return { envelopes, cursorAfterPoll };
  })
  .extend("pollWithoutCursor", async () => {
    const events = createMemoryEventStore();
    await events.createIfAbsent(
      authoredEvent("delivery-recent", { receivedAtMs: Date.now() - 1000 }),
    );
    return runPoll({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      events,
      cursors: createMemoryCursorStore(),
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
  })
  .extend("pollFromVanishedCursor", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    await cursors.write({ clientId: "octocat-author", eventId: "delivery-vanished" });
    await events.createIfAbsent(
      authoredEvent("delivery-recent", { receivedAtMs: Date.now() - 1000 }),
    );
    return runPoll({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
  })
  .extend("pollWithNothingFollowing", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: 100 }));
    await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
    const envelopes = await runPoll({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
    const cursorAfterPoll = await cursors.read("octocat-author");
    return { envelopes, cursorAfterPoll };
  })
  .extend("pollOverForeignEventsOnly", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    await events.createIfAbsent(authoredEvent("delivery-1", { receivedAtMs: 100 }));
    await events.createIfAbsent(
      authoredEvent("delivery-2", { receivedAtMs: 200, authorLogin: "hubot" }),
    );
    await cursors.write({ clientId: "octocat-author", eventId: "delivery-1" });
    const envelopes = await runPoll({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
    const cursorAfterPoll = await cursors.read("octocat-author");
    return { envelopes, cursorAfterPoll };
  })
  .extend("pollForSecondOperator", async () => {
    const events = createMemoryEventStore();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-octocat", { receivedAtMs: nowMs - 2000 }));
    await events.createIfAbsent(
      authoredEvent("delivery-hubot", { receivedAtMs: nowMs - 1000, authorLogin: "hubot" }),
    );
    return runPoll({
      clientId: "hubot-author",
      subscriberLogin: "hubot",
      events,
      cursors: createMemoryCursorStore(),
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
  });

describe("runPoll", () => {
  it("カーソル以降の所有イベントが 1 件だけエンベロープで返る", ({ pollFromCursor }) => {
    expect(pollFromCursor.envelopes.length).toStrictEqual(1);
  });

  it("カーソル以降の所有イベントがエンベロープで返る", ({ pollFromCursor }) => {
    expect(pollFromCursor.envelopes[0]?.delivery_id).toStrictEqual("delivery-2");
  });

  it("カーソルは所有外を含む走査末尾へ進む", ({ pollFromCursor }) => {
    expect(pollFromCursor.cursorAfterPoll).toStrictEqual("delivery-3");
  });

  it("カーソルなしは replay window から 1 件取得する", ({ pollWithoutCursor }) => {
    expect(pollWithoutCursor.length).toStrictEqual(1);
  });

  it("カーソルなしは replay window から取得する", ({ pollWithoutCursor }) => {
    expect(pollWithoutCursor[0]?.delivery_id).toStrictEqual("delivery-recent");
  });

  it("カーソルイベントが TTL で消えていたら 1 件にフォールバックする", ({
    pollFromVanishedCursor,
  }) => {
    expect(pollFromVanishedCursor.length).toStrictEqual(1);
  });

  it("カーソルイベントが TTL で消えていたら replay window にフォールバックする", ({
    pollFromVanishedCursor,
  }) => {
    expect(pollFromVanishedCursor[0]?.delivery_id).toStrictEqual("delivery-recent");
  });

  it("後続 0 件なら空配列になる", ({ pollWithNothingFollowing }) => {
    expect(pollWithNothingFollowing.envelopes).toStrictEqual([]);
  });

  it("後続 0 件ならカーソルは進まない", ({ pollWithNothingFollowing }) => {
    expect(pollWithNothingFollowing.cursorAfterPoll).toStrictEqual("delivery-1");
  });

  it("所有外イベントしか無ければ空配列になる", ({ pollOverForeignEventsOnly }) => {
    expect(pollOverForeignEventsOnly.envelopes).toStrictEqual([]);
  });

  it("所有外イベントしか無くてもカーソルは走査末尾へ進む", ({ pollOverForeignEventsOnly }) => {
    expect(pollOverForeignEventsOnly.cursorAfterPoll).toStrictEqual("delivery-2");
  });

  it("2 operator のイベントが混在しても所有分だけ 1 件返る", ({ pollForSecondOperator }) => {
    expect(pollForSecondOperator.length).toStrictEqual(1);
  });

  it("2 operator のイベントが混在してもそれぞれの所有分だけ返る", ({ pollForSecondOperator }) => {
    expect(pollForSecondOperator[0]?.delivery_id).toStrictEqual("delivery-hubot");
  });
});
