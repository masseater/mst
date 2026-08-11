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

describe("runBaseUpdateCheck", () => {
  test("非衝突の BEHIND だけが保存される", async () => {
    const events = createMemoryEventStore();
    const report = await runBaseUpdateCheck({
      github: githubWith([openPull({ mergeStateStatus: "BEHIND" })]),
      events,
    });
    const [stored] = await events.readSince(0);
    expect([report, stored?.deliveryId]).toStrictEqual([
      { scanned: 1, behind: 1, stored: 1 },
      "check-base-updates:7:base-sha:head-sha",
    ]);
  });

  test("DIRTY や CONFLICTING は衝突が優先で保存されない", async () => {
    const events = createMemoryEventStore();
    const report = await runBaseUpdateCheck({
      github: githubWith([
        openPull({ number: 7, mergeable: "CONFLICTING", mergeStateStatus: "BEHIND" }),
        openPull({ number: 8, mergeStateStatus: "DIRTY" }),
      ]),
      events,
    });
    expect([report, await events.readSince(0)]).toStrictEqual([
      { scanned: 2, behind: 0, stored: 0 },
      [],
    ]);
  });

  test("除外ラベル付きは BEHIND でも保存されない", async () => {
    const events = createMemoryEventStore();
    const report = await runBaseUpdateCheck({
      github: githubWith([
        openPull({ mergeStateStatus: "BEHIND", labelNames: ["exclude-auto-develop"] }),
      ]),
      events,
    });
    expect(report).toStrictEqual({ scanned: 1, behind: 0, stored: 0 });
  });

  test("CLEAN は保存されない", async () => {
    const events = createMemoryEventStore();
    const report = await runBaseUpdateCheck({ github: githubWith([openPull()]), events });
    expect(report).toStrictEqual({ scanned: 1, behind: 0, stored: 0 });
  });

  test("作者 null の PR は user なしペイロードで保存される", async () => {
    const events = createMemoryEventStore();
    await runBaseUpdateCheck({
      github: githubWith([openPull({ authorLogin: null, mergeStateStatus: "BEHIND" })]),
      events,
    });
    const [stored] = await events.readSince(0);
    expect(stored?.payload).toStrictEqual({
      action: "synchronize",
      pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
    });
  });

  test("同一状態の 2 回目のチェックは保存側の冪等性で 1 件のまま", async () => {
    const events = createMemoryEventStore();
    const github = githubWith([openPull({ mergeStateStatus: "BEHIND" })]);
    await runBaseUpdateCheck({ github, events });
    const secondReport = await runBaseUpdateCheck({ github, events });
    expect([secondReport, (await events.readSince(0)).length]).toStrictEqual([
      { scanned: 1, behind: 1, stored: 1 },
      1,
    ]);
  });
});
