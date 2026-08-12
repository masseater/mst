import { describe, expect, test } from "vite-plus/test";

import { runBaseUpdateCheck } from "./base-update-checker.ts";
import { createMemoryEventStore } from "./memory-store.ts";

import type { GithubPullSummary, GithubReader } from "./github-reader.ts";

const openPull = (shape: Partial<GithubPullSummary> = {}): GithubPullSummary => ({
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
  ...shape,
});

const githubWith = (pulls: readonly GithubPullSummary[]): GithubReader => ({
  resolveTokenLogin: () => Promise.resolve("octocat"),
  readRepositoryPrivacy: () => Promise.resolve(true),
  listOpenPullRequests: () => Promise.resolve(pulls),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve([]),
});

const it = test
  .extend("behindScan", async () => {
    const events = createMemoryEventStore();
    const report = await runBaseUpdateCheck({
      github: githubWith([openPull({ mergeStateStatus: "BEHIND" })]),
      events,
    });
    const [storedEvent] = await events.readSince(0);
    return { report, storedEvent };
  })
  .extend("conflictingScan", async () => {
    const events = createMemoryEventStore();
    const report = await runBaseUpdateCheck({
      github: githubWith([
        openPull({ number: 7, mergeable: "CONFLICTING", mergeStateStatus: "BEHIND" }),
        openPull({ number: 8, mergeStateStatus: "DIRTY" }),
      ]),
      events,
    });
    const storedEvents = await events.readSince(0);
    return { report, storedEvents };
  })
  .extend("excludedLabelScanReport", () =>
    runBaseUpdateCheck({
      github: githubWith([
        openPull({ mergeStateStatus: "BEHIND", labelNames: ["exclude-auto-develop"] }),
      ]),
      events: createMemoryEventStore(),
    }),
  )
  .extend("cleanScanReport", () =>
    runBaseUpdateCheck({
      github: githubWith([openPull()]),
      events: createMemoryEventStore(),
    }),
  )
  .extend("authorlessBehindStoredEvent", async () => {
    const events = createMemoryEventStore();
    await runBaseUpdateCheck({
      github: githubWith([openPull({ authorLogin: null, mergeStateStatus: "BEHIND" })]),
      events,
    });
    const [storedEvent] = await events.readSince(0);
    return storedEvent;
  })
  .extend("repeatedBehindScan", async () => {
    const events = createMemoryEventStore();
    const github = githubWith([openPull({ mergeStateStatus: "BEHIND" })]);
    await runBaseUpdateCheck({ github, events });
    const secondReport = await runBaseUpdateCheck({ github, events });
    const storedEvents = await events.readSince(0);
    return { secondReport, storedEvents };
  });

describe("runBaseUpdateCheck", () => {
  it("非衝突の BEHIND は 1 件走査されて 1 件保存される", ({ behindScan }) => {
    expect(behindScan.report).toStrictEqual({ scanned: 1, behind: 1, stored: 1 });
  });

  it("非衝突の BEHIND だけが保存される", ({ behindScan }) => {
    expect(behindScan.storedEvent?.deliveryId).toStrictEqual(
      "check-base-updates:7:base-sha:head-sha",
    );
  });

  it("DIRTY や CONFLICTING は衝突が優先で BEHIND に数えられない", ({ conflictingScan }) => {
    expect(conflictingScan.report).toStrictEqual({ scanned: 2, behind: 0, stored: 0 });
  });

  it("DIRTY や CONFLICTING は衝突が優先で保存されない", ({ conflictingScan }) => {
    expect(conflictingScan.storedEvents).toStrictEqual([]);
  });

  it("除外ラベル付きは BEHIND でも保存されない", ({ excludedLabelScanReport }) => {
    expect(excludedLabelScanReport).toStrictEqual({ scanned: 1, behind: 0, stored: 0 });
  });

  it("CLEAN は保存されない", ({ cleanScanReport }) => {
    expect(cleanScanReport).toStrictEqual({ scanned: 1, behind: 0, stored: 0 });
  });

  it("作者 null の PR は user なしペイロードで保存される", ({ authorlessBehindStoredEvent }) => {
    expect(authorlessBehindStoredEvent?.payload).toStrictEqual({
      action: "synchronize",
      pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
    });
  });

  it("同一状態の 2 回目のチェックも BEHIND として報告される", ({ repeatedBehindScan }) => {
    expect(repeatedBehindScan.secondReport).toStrictEqual({ scanned: 1, behind: 1, stored: 1 });
  });

  it("同一状態の 2 回目のチェックは保存側の冪等性で 1 件のまま", ({ repeatedBehindScan }) => {
    expect(repeatedBehindScan.storedEvents.length).toStrictEqual(1);
  });
});
