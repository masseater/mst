import { describe, expect, test } from "vite-plus/test";

import { runBaseUpdateCheck } from "./base-update-checker.ts";
import { EVENT_TTL_MS } from "./durations.ts";
import { createMemoryEventStore } from "./memory-event-store.ts";

describe("runBaseUpdateCheck", () => {
  const it = test
    .extend("behindScanReport", () =>
      runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: createMemoryEventStore(() => 0),
        now: () => 0,
      }))
    .extend("behindScanStoredEvents", async () => {
      const eventStore = createMemoryEventStore(() => 0);
      await runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: eventStore,
        now: () => 0,
      });
      return eventStore.readSince(0);
    })
    .extend("conflictingScanReport", () =>
      runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "CONFLICTING",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
              {
                number: 8,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "DIRTY",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: createMemoryEventStore(() => 0),
        now: () => 0,
      }),
    )
    .extend("conflictingScanStoredEvents", async () => {
      const eventStore = createMemoryEventStore(() => 0);
      await runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "CONFLICTING",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
              {
                number: 8,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "DIRTY",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: eventStore,
        now: () => 0,
      });
      return eventStore.readSince(0);
    })
    .extend("excludedLabelScanReport", () =>
      runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: ["exclude-auto-develop"],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: createMemoryEventStore(() => 0),
        now: () => 0,
      }),
    )
    .extend("cleanScanReport", () =>
      runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "CLEAN",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: createMemoryEventStore(() => 0),
        now: () => 0,
      }),
    )
    .extend("authorlessBehindStoredEvents", async () => {
      const eventStore = createMemoryEventStore(() => 0);
      await runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: null,
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: eventStore,
        now: () => 0,
      });
      return eventStore.readSince(0);
    })
    .extend("repeatedBehindSecondReport", async () => {
      const eventStore = createMemoryEventStore(() => 0);
      await runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: eventStore,
        now: () => 0,
      });
      return runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: eventStore,
        now: () => 0,
      });
    })
    .extend("repeatedBehindStoredEvents", async () => {
      const eventStore = createMemoryEventStore(() => 0);
      await runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: eventStore,
        now: () => 0,
      });
      await runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: eventStore,
        now: () => 0,
      });
      return eventStore.readSince(0);
    })
    .extend("behindScanReportWithoutAStampedClock", () =>
      runBaseUpdateCheck({
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "BEHIND",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        events: createMemoryEventStore(() => 0),
      }),
    );

  it("時刻を渡されなくても非衝突の BEHIND は 1 件走査されて 1 件保存される", ({
    behindScanReportWithoutAStampedClock,
  }) => {
    expect(behindScanReportWithoutAStampedClock).toStrictEqual({
      scanned: 1,
      behind: 1,
      stored: 1,
    });
  });

  it("非衝突の BEHIND は 1 件走査されて 1 件保存される", ({ behindScanReport }) => {
    expect(behindScanReport).toStrictEqual({ scanned: 1, behind: 1, stored: 1 });
  });

  it("非衝突の BEHIND は base と head を綴じた配送 ID で保存される", ({
    behindScanStoredEvents,
  }) => {
    expect(behindScanStoredEvents).toStrictEqual([
      {
        id: "check-base-updates:7:base-sha:head-sha",
        eventType: "pull_request",
        deliveryId: "check-base-updates:7:base-sha:head-sha",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "MERGEABLE",
            merge_state_status: "BEHIND",
            user: { login: "octocat" },
          },
        },
        receivedAtMs: 0,
        expiresAtMs: EVENT_TTL_MS,
      },
    ]);
  });

  it("DIRTY や CONFLICTING は衝突が優先で BEHIND に数えられない", ({ conflictingScanReport }) => {
    expect(conflictingScanReport).toStrictEqual({ scanned: 2, behind: 0, stored: 0 });
  });

  it("DIRTY や CONFLICTING は衝突が優先で保存されない", ({ conflictingScanStoredEvents }) => {
    expect(conflictingScanStoredEvents).toStrictEqual([]);
  });

  it("除外ラベル付きは BEHIND でも保存されない", ({ excludedLabelScanReport }) => {
    expect(excludedLabelScanReport).toStrictEqual({ scanned: 1, behind: 0, stored: 0 });
  });

  it("CLEAN は保存されない", ({ cleanScanReport }) => {
    expect(cleanScanReport).toStrictEqual({ scanned: 1, behind: 0, stored: 0 });
  });

  it("作者 null の PR は user なしペイロードで保存される", ({ authorlessBehindStoredEvents }) => {
    expect(authorlessBehindStoredEvents).toStrictEqual([
      {
        id: "check-base-updates:7:base-sha:head-sha",
        eventType: "pull_request",
        deliveryId: "check-base-updates:7:base-sha:head-sha",
        payload: {
          action: "synchronize",
          pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
        },
        receivedAtMs: 0,
        expiresAtMs: EVENT_TTL_MS,
      },
    ]);
  });

  it("同一状態の 2 回目のチェックも BEHIND として報告される", ({ repeatedBehindSecondReport }) => {
    expect(repeatedBehindSecondReport).toStrictEqual({ scanned: 1, behind: 1, stored: 1 });
  });

  it("同一状態の 2 回目のチェックは保存側の冪等性で 1 件のまま", ({
    repeatedBehindStoredEvents,
  }) => {
    expect(repeatedBehindStoredEvents).toStrictEqual([
      {
        id: "check-base-updates:7:base-sha:head-sha",
        eventType: "pull_request",
        deliveryId: "check-base-updates:7:base-sha:head-sha",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "MERGEABLE",
            merge_state_status: "BEHIND",
            user: { login: "octocat" },
          },
        },
        receivedAtMs: 0,
        expiresAtMs: EVENT_TTL_MS,
      },
    ]);
  });
});
