import { describe, expect, test, vi } from "vite-plus/test";

import { createMemoryEventStore } from "./memory-store.ts";
import { createOwnerFilter } from "./owner-filter.ts";

import type { GithubReader } from "./github-reader.ts";
import type { StoredEvent } from "./store.ts";

const relayedEvent = (
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

const it = test
  .extend("reviewRequestForNamedReviewer", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
        payload: {
          action: "review_requested",
          pull_request: { number: 7, user: { login: "octocat" } },
          requested_reviewer: { login: "hubot" },
        },
      }),
      subscriberLogin: "hubot",
    }))
  .extend("reviewRequestForAuthor", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
        payload: {
          action: "review_requested",
          pull_request: { number: 7, user: { login: "octocat" } },
          requested_reviewer: { login: "hubot" },
        },
      }),
      subscriberLogin: "octocat",
    }),
  )
  .extend("synchronizeForCurrentReviewer", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
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
    }),
  )
  .extend("synchronizeForAuthor", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
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
    }),
  )
  .extend("baseEditedForCurrentReviewer", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
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
    }),
  )
  .extend("titleEditedForCurrentReviewer", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
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
    }),
  )
  .extend("openedForMatchingAuthor", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      }),
      subscriberLogin: "octocat",
    }),
  )
  .extend("openedForDifferentlyCasedAuthor", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "OctoCat" } } },
      }),
      subscriberLogin: "octocat",
    }),
  )
  .extend("lookupOverRememberedPull", async () => {
    const resolvePullAuthor = vi.fn<GithubReader["resolvePullAuthor"]>();
    const ownerFilter = filterWith({ resolvePullAuthor });
    ownerFilter.remember(
      relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    const owned = await ownerFilter.owns({
      stored: relayedEvent("delivery-2", {
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
    return { owned, resolvePullAuthor };
  })
  .extend("ownershipFromStoredEvent", async () => {
    const eventStore = createMemoryEventStore();
    await eventStore.createIfAbsent(
      relayedEvent("delivery-authored", {
        payload: { pull_request: { number: 7, user: { login: "octocat" } } },
      }),
    );
    return createOwnerFilter({ events: eventStore, github: stubGithub() }).owns({
      stored: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
  })
  .extend("ownershipFromGithubState", () =>
    filterWith({ resolvePullAuthor: () => Promise.resolve("octocat") }).owns({
      stored: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    }),
  )
  .extend("ownershipWithoutResolvableAuthor", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    }),
  )
  .extend("ownershipWithoutPullNumber", () =>
    filterWith().owns({
      stored: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [] } },
      }),
      subscriberLogin: "octocat",
    }),
  )
  .extend("ownershipFromFirstResolvedPull", () =>
    filterWith({
      resolvePullAuthor: (prNumber) => Promise.resolve(prNumber === 7 ? "hubot" : "octocat"),
    }).owns({
      stored: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }, { number: 8 }] } },
      }),
      subscriberLogin: "octocat",
    }),
  )
  .extend("lookupAfterClose", async () => {
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
      stored: relayedEvent("delivery-3", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    return { owned, resolvePullAuthor };
  })
  .extend("lookupAfterNonClose", async () => {
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
      stored: relayedEvent("delivery-3", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
    return { owned, resolvePullAuthor };
  })
  .extend("lookupAfterNumberlessRemember", () => {
    const ownerFilter = filterWith();
    ownerFilter.remember(
      relayedEvent("delivery-1", {
        payload: { action: "opened", pull_request: { user: { login: "octocat" } } },
      }),
    );
    return ownerFilter.owns({
      stored: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
  })
  .extend("lookupAfterAuthorlessRemember", () => {
    const ownerFilter = filterWith();
    ownerFilter.remember(
      relayedEvent("delivery-1", { payload: { action: "opened", pull_request: { number: 7 } } }),
    );
    return ownerFilter.owns({
      stored: relayedEvent("delivery-2", {
        eventType: "check_suite",
        payload: { check_suite: { pull_requests: [{ number: 7 }] } },
      }),
      subscriberLogin: "octocat",
    });
  });

describe("review_requested の宛先判定", () => {
  it("指名された reviewer には配る", ({ reviewRequestForNamedReviewer }) => {
    expect(reviewRequestForNamedReviewer).toStrictEqual(true);
  });

  it("他人宛のレビュー依頼は作者にも配らない", ({ reviewRequestForAuthor }) => {
    expect(reviewRequestForAuthor).toStrictEqual(false);
  });
});

describe("レビュー入力変更の宛先判定", () => {
  it("synchronize は現任レビュアーに配る", ({ synchronizeForCurrentReviewer }) => {
    expect(synchronizeForCurrentReviewer).toStrictEqual(true);
  });

  it("synchronize は作者にも配る（両取り）", ({ synchronizeForAuthor }) => {
    expect(synchronizeForAuthor).toStrictEqual(true);
  });

  it("changes.base を伴う edited は現任レビュアーに配る", ({ baseEditedForCurrentReviewer }) => {
    expect(baseEditedForCurrentReviewer).toStrictEqual(true);
  });

  it("title だけの edited はレビュー入力変更ではなく reviewer には配らない", ({
    titleEditedForCurrentReviewer,
  }) => {
    expect(titleEditedForCurrentReviewer).toStrictEqual(false);
  });
});

describe("作者判定", () => {
  it("payload の作者と一致すれば配る", ({ openedForMatchingAuthor }) => {
    expect(openedForMatchingAuthor).toStrictEqual(true);
  });

  it("login の比較は大文字小文字を区別する", ({ openedForDifferentlyCasedAuthor }) => {
    expect(openedForDifferentlyCasedAuthor).toStrictEqual(false);
  });

  it("記憶済みの PR は作者無しイベントでもキャッシュで判定する", ({ lookupOverRememberedPull }) => {
    expect(lookupOverRememberedPull.owned).toStrictEqual(true);
  });

  it("記憶済みの PR の判定では解決器を呼ばない", ({ lookupOverRememberedPull }) => {
    expect(lookupOverRememberedPull.resolvePullAuthor.mock.calls.length).toStrictEqual(0);
  });

  it("キャッシュに無ければ保存イベントから作者を引く", ({ ownershipFromStoredEvent }) => {
    expect(ownershipFromStoredEvent).toStrictEqual(true);
  });

  it("保存イベントに無ければ GitHub の現在状態から作者を引く", ({ ownershipFromGithubState }) => {
    expect(ownershipFromGithubState).toStrictEqual(true);
  });

  it("どの PR でも作者を解決できなければ誰にも配らない", ({ ownershipWithoutResolvableAuthor }) => {
    expect(ownershipWithoutResolvableAuthor).toStrictEqual(false);
  });

  it("PR 番号も作者も無いイベントは誰にも配らない", ({ ownershipWithoutPullNumber }) => {
    expect(ownershipWithoutPullNumber).toStrictEqual(false);
  });

  it("複数 PR は最初に解決できた作者で即決する", ({ ownershipFromFirstResolvedPull }) => {
    expect(ownershipFromFirstResolvedPull).toStrictEqual(false);
  });

  it("解決器の失敗は黙って配らず伝播する", async () => {
    await expect(
      filterWith({
        resolvePullAuthor: () => Promise.reject(new Error("github unreachable")),
      }).owns({
        stored: relayedEvent("delivery-2", {
          eventType: "check_suite",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
        }),
        subscriberLogin: "octocat",
      }),
    ).rejects.toThrow("github unreachable");
  });
});

describe("キャッシュの破棄", () => {
  it("close イベントで記憶が破棄される", ({ lookupAfterClose }) => {
    expect(lookupAfterClose.owned).toStrictEqual(false);
  });

  it("close イベントの後は解決器をやり直す", ({ lookupAfterClose }) => {
    expect(lookupAfterClose.resolvePullAuthor.mock.calls.length).toStrictEqual(1);
  });

  it("close でないイベントでは記憶を破棄しない", ({ lookupAfterNonClose }) => {
    expect(lookupAfterNonClose.owned).toStrictEqual(true);
  });

  it("close でないイベントの後は解決器を呼ばない", ({ lookupAfterNonClose }) => {
    expect(lookupAfterNonClose.resolvePullAuthor.mock.calls.length).toStrictEqual(0);
  });

  it("PR 番号の無いイベントの記憶は何も登録しない", ({ lookupAfterNumberlessRemember }) => {
    expect(lookupAfterNumberlessRemember).toStrictEqual(false);
  });

  it("作者無しイベントの記憶は何も登録しない", ({ lookupAfterAuthorlessRemember }) => {
    expect(lookupAfterAuthorlessRemember).toStrictEqual(false);
  });
});
