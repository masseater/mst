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

describe("runPoll", () => {
  test("カーソル以降の所有イベントがエンベロープで返りカーソルは走査末尾へ進む", async () => {
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
    expect([
      envelopes.map((envelope) => envelope.delivery_id),
      await cursors.read("octocat-author"),
    ]).toStrictEqual([["delivery-2"], "delivery-3"]);
  });

  test("カーソルなしは replay window から取得する", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-recent", { receivedAtMs: nowMs - 1000 }));
    const envelopes = await runPoll({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
    expect(envelopes.map((envelope) => envelope.delivery_id)).toStrictEqual(["delivery-recent"]);
  });

  test("カーソルイベントが TTL で消えていたら replay window にフォールバックする", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const nowMs = Date.now();
    await cursors.write({ clientId: "octocat-author", eventId: "delivery-vanished" });
    await events.createIfAbsent(authoredEvent("delivery-recent", { receivedAtMs: nowMs - 1000 }));
    const envelopes = await runPoll({
      clientId: "octocat-author",
      subscriberLogin: "octocat",
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
    expect(envelopes.map((envelope) => envelope.delivery_id)).toStrictEqual(["delivery-recent"]);
  });

  test("後続 0 件なら空配列でカーソルは進まない", async () => {
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
    expect([envelopes, await cursors.read("octocat-author")]).toStrictEqual([[], "delivery-1"]);
  });

  test("所有外イベントしか無くてもカーソルは走査末尾へ進む", async () => {
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
    expect([envelopes, await cursors.read("octocat-author")]).toStrictEqual([[], "delivery-2"]);
  });

  test("2 operator のイベントが混在してもそれぞれの所有分だけ返る", async () => {
    const events = createMemoryEventStore();
    const cursors = createMemoryCursorStore();
    const nowMs = Date.now();
    await events.createIfAbsent(authoredEvent("delivery-octocat", { receivedAtMs: nowMs - 2000 }));
    await events.createIfAbsent(
      authoredEvent("delivery-hubot", { receivedAtMs: nowMs - 1000, authorLogin: "hubot" }),
    );
    const hubotEnvelopes = await runPoll({
      clientId: "hubot-author",
      subscriberLogin: "hubot",
      events,
      cursors,
      ownerFilter: createOwnerFilter({ events, github: stubGithub }),
    });
    expect(hubotEnvelopes.map((envelope) => envelope.delivery_id)).toStrictEqual([
      "delivery-hubot",
    ]);
  });
});
