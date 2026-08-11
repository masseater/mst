import { describe, expect, test } from "vite-plus/test";

import { runStartupDrain } from "./startup-drain.ts";

import type { CheckBucket, GithubPullSummary, GithubReader } from "./github-reader.ts";

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

const githubWith = (github: {
  readonly pulls: readonly GithubPullSummary[];
  readonly buckets?: readonly CheckBucket[];
}): GithubReader => ({
  resolveTokenLogin: () => Promise.resolve("octocat"),
  readRepositoryPrivacy: () => Promise.resolve(true),
  listOpenPullRequests: () => Promise.resolve(github.pulls),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve(github.buckets ?? []),
});

describe("reviewer モードの巻き取り", () => {
  test("自分が requested reviewer の PR ごとに review-requested を合成する", async () => {
    const pulls = [
      openPull({ number: 7, requestedReviewerLogins: ["hubot"], draft: true }),
      openPull({ number: 8, requestedReviewerLogins: ["octocat"] }),
    ];
    const envelopes = await runStartupDrain({
      login: "hubot",
      mode: "reviewer",
      github: githubWith({ pulls }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:head-sha:review-requested",
        payload: {
          action: "review_requested",
          pull_request: { number: 7, title: "Add retry", draft: true, user: { login: "octocat" } },
        },
      },
    ]);
  });

  test("作者削除済みの PR は user なしのペイロードで出る", async () => {
    const pulls = [openPull({ authorLogin: null, requestedReviewerLogins: ["hubot"] })];
    const [envelope] = await runStartupDrain({
      login: "hubot",
      mode: "reviewer",
      github: githubWith({ pulls }),
      ciSuppressionLabel: undefined,
    });
    expect(envelope?.payload).toStrictEqual({
      action: "review_requested",
      pull_request: { number: 7, title: "Add retry", draft: false },
    });
  });

  test("除外ラベル付き PR は対象外になる", async () => {
    const pulls = [
      openPull({ requestedReviewerLogins: ["hubot"], labelNames: ["exclude-auto-develop"] }),
    ];
    const envelopes = await runStartupDrain({
      login: "hubot",
      mode: "reviewer",
      github: githubWith({ pulls }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([]);
  });
});

describe("author モードの巻き取り", () => {
  test("変更要求と CI 失敗が同時ならレビュー → CI の順で両方出る", async () => {
    const pulls = [openPull({ reviewDecision: "CHANGES_REQUESTED" })];
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls, buckets: ["pass", "fail"] }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes.map((envelope) => envelope.delivery_id)).toStrictEqual([
      "startup-drain:pull_request_review:7:head-sha:changes_requested",
      "startup-drain:check_suite:7:head-sha:failure",
    ]);
  });

  test("衝突と base 遅れは判定式が独立で両方出うる", async () => {
    const pulls = [openPull({ mergeable: "CONFLICTING", mergeStateStatus: "BEHIND" })];
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes.map((envelope) => envelope.delivery_id)).toStrictEqual([
      "startup-drain:pull_request:7:base-sha:head-sha:merge-conflict",
      "startup-drain:pull_request:7:base-sha:head-sha:base-update",
    ]);
  });

  test("approved でチェック pass なら何も出ない", async () => {
    const pulls = [openPull({ reviewDecision: "APPROVED" })];
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls, buckets: ["pass", "pass"] }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([]);
  });

  test("他人の PR は出ない", async () => {
    const pulls = [openPull({ authorLogin: "hubot", mergeStateStatus: "BEHIND" })];
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([]);
  });

  test("チェック 0 件は成功扱いでイベントなし", async () => {
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: [] }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([]);
  });

  test("pending があれば failure でもイベントなし", async () => {
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: ["fail", "pending"] }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([]);
  });

  test("cancel や skip だけなら判定なしでイベントなし", async () => {
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: ["cancel", "skipping"] }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([]);
  });

  test("pass だけなら成功でイベントなし", async () => {
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: ["pass"] }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes).toStrictEqual([]);
  });

  test("抑止ラベル付きの PR は CI 失敗イベントを出さない", async () => {
    const pulls = [openPull({ labelNames: ["needs-human"] })];
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls, buckets: ["fail"] }),
      ciSuppressionLabel: "needs-human",
    });
    expect(envelopes).toStrictEqual([]);
  });

  test("BEHIND は base-update イベントになる", async () => {
    const pulls = [openPull({ mergeStateStatus: "BEHIND" })];
    const envelopes = await runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls }),
      ciSuppressionLabel: undefined,
    });
    expect(envelopes.map((envelope) => envelope.delivery_id)).toStrictEqual([
      "startup-drain:pull_request:7:base-sha:head-sha:base-update",
    ]);
  });
});
