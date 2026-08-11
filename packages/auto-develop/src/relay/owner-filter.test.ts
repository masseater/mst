import { describe, expect, test, vi } from "vite-plus/test";

import { createMemoryEventStore } from "./memory-store.ts";
import { createOwnerFilter } from "./owner-filter.ts";

import type { GithubReader } from "./github-reader.ts";
import type { StoredEvent } from "./store.ts";

const relayedEvent = (id: string, shape: Partial<Omit<StoredEvent, "id">> = {}): StoredEvent => ({
  id,
  eventType: "pull_request",
  deliveryId: id,
  payload: {},
  receivedAtMs: 100,
  expiresAtMs: Number.MAX_SAFE_INTEGER,
  ...shape,
});

const stubGithub = (overrides: Partial<GithubReader> = {}): GithubReader => ({
  resolveTokenLogin: () => Promise.resolve("octocat"),
  readRepositoryPrivacy: () => Promise.resolve(true),
  listOpenPullRequests: () => Promise.resolve([]),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve([]),
  ...overrides,
});

const filterWith = (overrides: Partial<GithubReader> = {}) =>
  createOwnerFilter({ events: createMemoryEventStore(), github: stubGithub(overrides) });

describe("review_requested の宛先判定", () => {
  test("指名された reviewer には配る", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: {
          action: "review_requested",
          pull_request: { number: 7, user: { login: "octocat" } },
          requested_reviewer: { login: "hubot" },
        },
      }),
      subscriberLogin: "hubot",
    });
    expect(owned).toStrictEqual(true);
  });

  test("他人宛のレビュー依頼は作者にも配らない", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: {
          action: "review_requested",
          pull_request: { number: 7, user: { login: "octocat" } },
          requested_reviewer: { login: "hubot" },
        },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(false);
  });
});

describe("レビュー入力変更の宛先判定", () => {
  test("synchronize は現任レビュアーに配る", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            user: { login: "octocat" },
            requested_reviewers: [{ login: "hubot" }],
          },
        },
      }),
      subscriberLogin: "hubot",
    });
    expect(owned).toStrictEqual(true);
  });

  test("synchronize は作者にも配る（両取り）", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            user: { login: "octocat" },
            requested_reviewers: [{ login: "hubot" }],
          },
        },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(true);
  });

  test("changes.base を伴う edited は現任レビュアーに配る", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: {
          action: "edited",
          changes: { base: {} },
          pull_request: {
            number: 7,
            user: { login: "octocat" },
            requested_reviewers: [{ login: "hubot" }],
          },
        },
      }),
      subscriberLogin: "hubot",
    });
    expect(owned).toStrictEqual(true);
  });

  test("title だけの edited はレビュー入力変更ではなく reviewer には配らない", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: {
          action: "edited",
          changes: { title: { from: "Old" } },
          pull_request: {
            number: 7,
            user: { login: "octocat" },
            requested_reviewers: [{ login: "hubot" }],
          },
        },
      }),
      subscriberLogin: "hubot",
    });
    expect(owned).toStrictEqual(false);
  });
});

describe("作者判定", () => {
  test("payload の作者と一致すれば配る", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(true);
  });

  test("login の比較は大文字小文字を区別する", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "OctoCat" } } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(false);
  });

  test("記憶済みの PR は作者無しイベントでもキャッシュで判定し解決器を呼ばない", async () => {
    const resolvePullAuthor = vi.fn<GithubReader["resolvePullAuthor"]>();
    const ownerFilter = filterWith({ resolvePullAuthor });
    ownerFilter.remember(
      relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: {
          action: "completed",
          check_suite: {
            conclusion: "failure",
            head_sha: "0a1b2c3",
            pull_requests: [{ number: 7 }],
          },
        },
      }),
      subscriberLogin: "octocat",
    });
    expect([owned, resolvePullAuthor.mock.calls.length]).toStrictEqual([true, 0]);
  });

  test("キャッシュに無ければ保存イベントから作者を引く", async () => {
    const events = createMemoryEventStore();
    await events.createIfAbsent(
      relayedEvent("delivery-authored", {
        payload: { pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    const ownerFilter = createOwnerFilter({ events, github: stubGithub() });
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(true);
  });

  test("保存イベントに無ければ GitHub の現在状態から作者を引く", async () => {
    const ownerFilter = filterWith({ resolvePullAuthor: () => Promise.resolve("octocat") });
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(true);
  });

  test("どの PR でも作者を解決できなければ誰にも配らない", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(false);
  });

  test("PR 番号も作者も無いイベントは誰にも配らない", async () => {
    const owned = await filterWith().owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [] } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(false);
  });

  test("複数 PR は最初に解決できた作者で即決する", async () => {
    const ownerFilter = filterWith({
      resolvePullAuthor: (prNumber) => Promise.resolve(prNumber === 7 ? "hubot" : "octocat"),
    });
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }, { number: 8 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(false);
  });

  test("解決器の失敗は黙って配らず伝播する", async () => {
    const ownerFilter = filterWith({
      resolvePullAuthor: () => Promise.reject(new Error("github unreachable")),
    });
    await expect(
      ownerFilter.owns({
        event: relayedEvent("delivery-2", {
          eventType: "check_suite",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
        }),
        subscriberLogin: "octocat",
      }),
    ).rejects.toThrow("github unreachable");
  });
});

describe("キャッシュの破棄", () => {
  test("close イベントで記憶が破棄され次は解決器をやり直す", async () => {
    const resolvePullAuthor = vi.fn<GithubReader["resolvePullAuthor"]>(() =>
      Promise.resolve("hubot"),
    );
    const ownerFilter = filterWith({ resolvePullAuthor });
    ownerFilter.remember(
      relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    ownerFilter.discardIfClosed(
      relayedEvent("delivery-2", { payload: { action: "closed", pull_request: { number: 7 } } }),
    );
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-3", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect([owned, resolvePullAuthor.mock.calls.length]).toStrictEqual([false, 1]);
  });

  test("close でないイベントでは記憶を破棄しない", async () => {
    const resolvePullAuthor = vi.fn<GithubReader["resolvePullAuthor"]>();
    const ownerFilter = filterWith({ resolvePullAuthor });
    ownerFilter.remember(
      relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    ownerFilter.discardIfClosed(
      relayedEvent("delivery-2", { payload: { action: "labeled", pull_request: { number: 7 } } }),
    );
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-3", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect([owned, resolvePullAuthor.mock.calls.length]).toStrictEqual([true, 0]);
  });

  test("PR 番号の無いイベントの記憶は何も登録しない", async () => {
    const ownerFilter = filterWith();
    ownerFilter.remember(
      relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { user: { login: "octocat" } } },
      }),
    );
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(false);
  });

  test("作者無しイベントの記憶は何も登録しない", async () => {
    const ownerFilter = filterWith();
    ownerFilter.remember(
      relayedEvent("delivery-1", { payload: { action: "opened", pull_request: { number: 7 } } }),
    );
    const owned = await ownerFilter.owns({
      event: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    expect(owned).toStrictEqual(false);
  });
});
