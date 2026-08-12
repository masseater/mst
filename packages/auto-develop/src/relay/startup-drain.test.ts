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

const it = test
  .extend("reviewerDrain", () =>
    runStartupDrain({
      login: "hubot",
      mode: "reviewer",
      github: githubWith({
        pulls: [
          openPull({ number: 7, requestedReviewerLogins: ["hubot"], draft: true }),
          openPull({ number: 8, requestedReviewerLogins: ["octocat"] }),
        ],
      }),
      ciSuppressionLabel: undefined,
    }))
  .extend("authorlessReviewerDrain", () =>
    runStartupDrain({
      login: "hubot",
      mode: "reviewer",
      github: githubWith({
        pulls: [openPull({ authorLogin: null, requestedReviewerLogins: ["hubot"] })],
      }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("excludedLabelReviewerDrain", () =>
    runStartupDrain({
      login: "hubot",
      mode: "reviewer",
      github: githubWith({
        pulls: [
          openPull({ requestedReviewerLogins: ["hubot"], labelNames: ["exclude-auto-develop"] }),
        ],
      }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("changesRequestedWithFailingCiDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({
        pulls: [openPull({ reviewDecision: "CHANGES_REQUESTED" })],
        buckets: ["pass", "fail"],
      }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("conflictingAndBehindDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({
        pulls: [openPull({ mergeable: "CONFLICTING", mergeStateStatus: "BEHIND" })],
      }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("approvedAndPassingDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({
        pulls: [openPull({ reviewDecision: "APPROVED" })],
        buckets: ["pass", "pass"],
      }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("foreignAuthorDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({
        pulls: [openPull({ authorLogin: "hubot", mergeStateStatus: "BEHIND" })],
      }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("noChecksDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: [] }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("pendingChecksDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: ["fail", "pending"] }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("cancelledChecksDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: ["cancel", "skipping"] }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("passingChecksDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull()], buckets: ["pass"] }),
      ciSuppressionLabel: undefined,
    }),
  )
  .extend("suppressedCiFailureDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull({ labelNames: ["needs-human"] })], buckets: ["fail"] }),
      ciSuppressionLabel: "needs-human",
    }),
  )
  .extend("behindDrain", () =>
    runStartupDrain({
      login: "octocat",
      mode: "author",
      github: githubWith({ pulls: [openPull({ mergeStateStatus: "BEHIND" })] }),
      ciSuppressionLabel: undefined,
    }),
  );

describe("reviewer モードの巻き取り", () => {
  it("自分が requested reviewer の PR ごとに review-requested を合成する", ({ reviewerDrain }) => {
    expect(reviewerDrain).toStrictEqual([
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

  it("作者削除済みの PR は user なしのペイロードで出る", ({ authorlessReviewerDrain }) => {
    expect(authorlessReviewerDrain[0]?.payload).toStrictEqual({
      action: "review_requested",
      pull_request: { number: 7, title: "Add retry", draft: false },
    });
  });

  it("除外ラベル付き PR は対象外になる", ({ excludedLabelReviewerDrain }) => {
    expect(excludedLabelReviewerDrain).toStrictEqual([]);
  });
});

describe("author モードの巻き取り", () => {
  it("変更要求と CI 失敗が同時なら 2 件出る", ({ changesRequestedWithFailingCiDrain }) => {
    expect(changesRequestedWithFailingCiDrain.length).toStrictEqual(2);
  });

  it("変更要求と CI 失敗が同時ならレビューが先に出る", ({ changesRequestedWithFailingCiDrain }) => {
    expect(changesRequestedWithFailingCiDrain[0]?.delivery_id).toStrictEqual(
      "startup-drain:pull_request_review:7:head-sha:changes_requested",
    );
  });

  it("変更要求と CI 失敗が同時なら CI が後に出る", ({ changesRequestedWithFailingCiDrain }) => {
    expect(changesRequestedWithFailingCiDrain[1]?.delivery_id).toStrictEqual(
      "startup-drain:check_suite:7:head-sha:failure",
    );
  });

  it("衝突と base 遅れは判定式が独立で 2 件出る", ({ conflictingAndBehindDrain }) => {
    expect(conflictingAndBehindDrain.length).toStrictEqual(2);
  });

  it("衝突と base 遅れは判定式が独立で衝突が出る", ({ conflictingAndBehindDrain }) => {
    expect(conflictingAndBehindDrain[0]?.delivery_id).toStrictEqual(
      "startup-drain:pull_request:7:base-sha:head-sha:merge-conflict",
    );
  });

  it("衝突と base 遅れは判定式が独立で base 遅れも出る", ({ conflictingAndBehindDrain }) => {
    expect(conflictingAndBehindDrain[1]?.delivery_id).toStrictEqual(
      "startup-drain:pull_request:7:base-sha:head-sha:base-update",
    );
  });

  it("approved でチェック pass なら何も出ない", ({ approvedAndPassingDrain }) => {
    expect(approvedAndPassingDrain).toStrictEqual([]);
  });

  it("他人の PR は出ない", ({ foreignAuthorDrain }) => {
    expect(foreignAuthorDrain).toStrictEqual([]);
  });

  it("チェック 0 件は成功扱いでイベントなし", ({ noChecksDrain }) => {
    expect(noChecksDrain).toStrictEqual([]);
  });

  it("pending があれば failure でもイベントなし", ({ pendingChecksDrain }) => {
    expect(pendingChecksDrain).toStrictEqual([]);
  });

  it("cancel や skip だけなら判定なしでイベントなし", ({ cancelledChecksDrain }) => {
    expect(cancelledChecksDrain).toStrictEqual([]);
  });

  it("pass だけなら成功でイベントなし", ({ passingChecksDrain }) => {
    expect(passingChecksDrain).toStrictEqual([]);
  });

  it("抑止ラベル付きの PR は CI 失敗イベントを出さない", ({ suppressedCiFailureDrain }) => {
    expect(suppressedCiFailureDrain).toStrictEqual([]);
  });

  it("BEHIND は base-update イベントを 1 件出す", ({ behindDrain }) => {
    expect(behindDrain.length).toStrictEqual(1);
  });

  it("BEHIND は base-update イベントになる", ({ behindDrain }) => {
    expect(behindDrain[0]?.delivery_id).toStrictEqual(
      "startup-drain:pull_request:7:base-sha:head-sha:base-update",
    );
  });
});
