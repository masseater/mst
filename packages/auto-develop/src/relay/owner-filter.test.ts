import { describe, expect, test, vi } from "vite-plus/test";

import { createMemoryEventStore } from "./memory-event-store.ts";
import { createOwnerFilter } from "./owner-filter.ts";

import type { GithubReader } from "./github-reader.ts";

describe("review_requested の宛先判定", () => {
  const it = test
    .extend("reviewRequestForNamedReviewer", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: {
            action: "review_requested",
            pull_request: { number: 7, user: { login: "octocat" } },
            requested_reviewer: { login: "hubot" },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "hubot",
      }))
    .extend("reviewRequestForAuthor", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: {
            action: "review_requested",
            pull_request: { number: 7, user: { login: "octocat" } },
            requested_reviewer: { login: "hubot" },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }),
    );

  it("指名された reviewer には配る", ({ reviewRequestForNamedReviewer }) => {
    expect(reviewRequestForNamedReviewer).toStrictEqual(true);
  });

  it("他人宛のレビュー依頼は作者にも配らない", ({ reviewRequestForAuthor }) => {
    expect(reviewRequestForAuthor).toStrictEqual(false);
  });
});

describe("レビュー入力変更の宛先判定", () => {
  const it = test
    .extend("synchronizeForCurrentReviewer", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: {
            action: "synchronize",
            pull_request: {
              number: 7,
              user: { login: "octocat" },
              requested_reviewers: [{ login: "hubot" }],
            },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "hubot",
      }))
    .extend("synchronizeForAuthor", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: {
            action: "synchronize",
            pull_request: {
              number: 7,
              user: { login: "octocat" },
              requested_reviewers: [{ login: "hubot" }],
            },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }),
    )
    .extend("baseEditedForCurrentReviewer", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: {
            action: "edited",
            changes: { base: {} },
            pull_request: {
              number: 7,
              user: { login: "octocat" },
              requested_reviewers: [{ login: "hubot" }],
            },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "hubot",
      }),
    )
    .extend("titleEditedForCurrentReviewer", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: {
            action: "edited",
            changes: { title: { from: "Old" } },
            pull_request: {
              number: 7,
              user: { login: "octocat" },
              requested_reviewers: [{ login: "hubot" }],
            },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "hubot",
      }),
    );

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
  const it = test
    .extend("openedForMatchingAuthor", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }))
    .extend("openedForDifferentlyCasedAuthor", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-1",
          eventType: "pull_request",
          deliveryId: "delivery-1",
          payload: { action: "opened", pull_request: { number: 7, user: { login: "OctoCat" } } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }),
    )
    .extend("ownershipOverRememberedPull", () => {
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: vi.fn<GithubReader["resolvePullAuthor"]>(),
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return ownerFilter.owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: {
            action: "completed",
            check_suite: {
              conclusion: "failure",
              head_sha: "0a1b2c3",
              pull_requests: [{ number: 7 }],
            },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
    })
    .extend("resolverAfterRememberedPull", async () => {
      const resolvePullAuthor = vi.fn<GithubReader["resolvePullAuthor"]>();
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor,
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await ownerFilter.owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: {
            action: "completed",
            check_suite: {
              conclusion: "failure",
              head_sha: "0a1b2c3",
              pull_requests: [{ number: 7 }],
            },
          },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
      return resolvePullAuthor;
    })
    .extend("ownershipFromStoredEvent", async () => {
      const relayedEvents = createMemoryEventStore();
      await relayedEvents.createIfAbsent({
        id: "delivery-authored",
        eventType: "pull_request",
        deliveryId: "delivery-authored",
        payload: { pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return createOwnerFilter({
        events: relayedEvents,
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
    })
    .extend("ownershipFromGithubState", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve("octocat"),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }),
    )
    .extend("ownershipWithoutResolvableAuthor", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }),
    )
    .extend("ownershipWithoutPullNumber", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { check_suite: { pull_requests: [] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }),
    )
    .extend("ownershipFromFirstResolvedPull", () =>
      createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: (prNumber) => Promise.resolve(prNumber === 7 ? "hubot" : "octocat"),
          listCheckBuckets: () => Promise.resolve([]),
        },
      }).owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { check_suite: { pull_requests: [{ number: 7 }, { number: 8 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      }),
    )
    .extend("resolverFailurePropagatedToCaller", async () => {
      try {
        return await createOwnerFilter({
          events: createMemoryEventStore(),
          github: {
            resolveTokenLogin: () => Promise.resolve("octocat"),
            readRepositoryPrivacy: () => Promise.resolve(true),
            listOpenPullRequests: () => Promise.resolve([]),
            resolvePullAuthor: () => Promise.reject(new Error("github unreachable")),
            listCheckBuckets: () => Promise.resolve([]),
          },
        }).owns({
          stored: {
            id: "delivery-2",
            eventType: "check_suite",
            deliveryId: "delivery-2",
            payload: { check_suite: { pull_requests: [{ number: 7 }] } },
            receivedAtMs: 100,
            expiresAtMs: Number.MAX_SAFE_INTEGER,
          },
          subscriberLogin: "octocat",
        });
      } catch (githubFailure) {
        return githubFailure;
      }
    });

  it("payload の作者と一致すれば配る", ({ openedForMatchingAuthor }) => {
    expect(openedForMatchingAuthor).toStrictEqual(true);
  });

  it("login の比較は大文字小文字を区別する", ({ openedForDifferentlyCasedAuthor }) => {
    expect(openedForDifferentlyCasedAuthor).toStrictEqual(false);
  });

  it("記憶済みの PR は作者無しイベントでもキャッシュで判定する", ({
    ownershipOverRememberedPull,
  }) => {
    expect(ownershipOverRememberedPull).toStrictEqual(true);
  });

  it("記憶済みの PR の判定では解決器を呼ばない", ({ resolverAfterRememberedPull }) => {
    expect(resolverAfterRememberedPull).not.toHaveBeenCalled();
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

  it("解決器の失敗は黙って配らず伝播する", ({ resolverFailurePropagatedToCaller }) => {
    expect(resolverFailurePropagatedToCaller).toStrictEqual(new Error("github unreachable"));
  });
});

describe("キャッシュの破棄", () => {
  const it = test
    .extend("ownershipAfterClose", () => {
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve("hubot"),
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      ownerFilter.discardIfClosed({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "closed", pull_request: { number: 7 } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return ownerFilter.owns({
        stored: {
          id: "delivery-3",
          eventType: "check_suite",
          deliveryId: "delivery-3",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
    })
    .extend("resolverAfterClose", async () => {
      const resolvePullAuthor = vi.fn<GithubReader["resolvePullAuthor"]>(() =>
        Promise.resolve("hubot"),
      );
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor,
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      ownerFilter.discardIfClosed({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "closed", pull_request: { number: 7 } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await ownerFilter.owns({
        stored: {
          id: "delivery-3",
          eventType: "check_suite",
          deliveryId: "delivery-3",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
      return resolvePullAuthor;
    })
    .extend("ownershipAfterNonClose", () => {
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: vi.fn<GithubReader["resolvePullAuthor"]>(),
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      ownerFilter.discardIfClosed({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "labeled", pull_request: { number: 7 } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return ownerFilter.owns({
        stored: {
          id: "delivery-3",
          eventType: "check_suite",
          deliveryId: "delivery-3",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
    })
    .extend("resolverAfterNonClose", async () => {
      const resolvePullAuthor = vi.fn<GithubReader["resolvePullAuthor"]>();
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor,
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7, user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      ownerFilter.discardIfClosed({
        id: "delivery-2",
        eventType: "pull_request",
        deliveryId: "delivery-2",
        payload: { action: "labeled", pull_request: { number: 7 } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      await ownerFilter.owns({
        stored: {
          id: "delivery-3",
          eventType: "check_suite",
          deliveryId: "delivery-3",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
      return resolvePullAuthor;
    })
    .extend("ownershipAfterNumberlessRemember", () => {
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { user: { login: "octocat" } } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return ownerFilter.owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
    })
    .extend("ownershipAfterAuthorlessRemember", () => {
      const ownerFilter = createOwnerFilter({
        events: createMemoryEventStore(),
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () => Promise.resolve([]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
      });
      ownerFilter.remember({
        id: "delivery-1",
        eventType: "pull_request",
        deliveryId: "delivery-1",
        payload: { action: "opened", pull_request: { number: 7 } },
        receivedAtMs: 100,
        expiresAtMs: Number.MAX_SAFE_INTEGER,
      });
      return ownerFilter.owns({
        stored: {
          id: "delivery-2",
          eventType: "check_suite",
          deliveryId: "delivery-2",
          payload: { check_suite: { pull_requests: [{ number: 7 }] } },
          receivedAtMs: 100,
          expiresAtMs: Number.MAX_SAFE_INTEGER,
        },
        subscriberLogin: "octocat",
      });
    });

  it("close イベントで記憶が破棄される", ({ ownershipAfterClose }) => {
    expect(ownershipAfterClose).toStrictEqual(false);
  });

  it("close イベントの後は解決器をやり直す", ({ resolverAfterClose }) => {
    expect(resolverAfterClose).toHaveBeenCalledExactlyOnceWith(7);
  });

  it("close でないイベントでは記憶を破棄しない", ({ ownershipAfterNonClose }) => {
    expect(ownershipAfterNonClose).toStrictEqual(true);
  });

  it("close でないイベントの後は解決器を呼ばない", ({ resolverAfterNonClose }) => {
    expect(resolverAfterNonClose).not.toHaveBeenCalled();
  });

  it("PR 番号の無いイベントの記憶は何も登録しない", ({ ownershipAfterNumberlessRemember }) => {
    expect(ownershipAfterNumberlessRemember).toStrictEqual(false);
  });

  it("作者無しイベントの記憶は何も登録しない", ({ ownershipAfterAuthorlessRemember }) => {
    expect(ownershipAfterAuthorlessRemember).toStrictEqual(false);
  });
});
