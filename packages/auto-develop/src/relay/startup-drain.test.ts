import { describe, expect, test } from "vite-plus/test";

import { runStartupDrain } from "./startup-drain.ts";

describe("reviewer モードの巻き取り", () => {
  const it = test
    .extend("requestedReviewerDrain", () =>
      runStartupDrain({
        login: "hubot",
        mode: "reviewer",
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: true,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "CLEAN",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: ["hubot"],
              },
              {
                number: 8,
                title: "Add retry",
                draft: false,
                authorLogin: "octocat",
                baseSha: "base-sha",
                headSha: "head-sha",
                mergeable: "MERGEABLE",
                mergeStateStatus: "CLEAN",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: ["octocat"],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        ciSuppressionLabel: undefined,
      }))
    .extend("authorlessRequestedReviewerDrain", () =>
      runStartupDrain({
        login: "hubot",
        mode: "reviewer",
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
                mergeStateStatus: "CLEAN",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: ["hubot"],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("excludedLabelReviewerDrain", () =>
      runStartupDrain({
        login: "hubot",
        mode: "reviewer",
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
                labelNames: ["exclude-auto-develop"],
                requestedReviewerLogins: ["hubot"],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        ciSuppressionLabel: undefined,
      }),
    );

  it("自分が requested reviewer の PR だけ review-requested になる", ({
    requestedReviewerDrain,
  }) => {
    expect(requestedReviewerDrain).toStrictEqual([
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

  it("作者削除済みの PR は user なしのペイロードで出る", ({ authorlessRequestedReviewerDrain }) => {
    expect(authorlessRequestedReviewerDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:head-sha:review-requested",
        payload: {
          action: "review_requested",
          pull_request: { number: 7, title: "Add retry", draft: false },
        },
      },
    ]);
  });

  it("除外ラベル付き PR は対象外になる", ({ excludedLabelReviewerDrain }) => {
    expect(excludedLabelReviewerDrain).toStrictEqual([]);
  });
});

describe("author モードの巻き取り", () => {
  const it = test
    .extend("changesRequestedDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
                reviewDecision: "CHANGES_REQUESTED",
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve(["pass"]),
        },
        ciSuppressionLabel: undefined,
      }))
    .extend("failingCiDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
          listCheckBuckets: () => Promise.resolve(["fail"]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("changesRequestedWithFailingCiDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
                reviewDecision: "CHANGES_REQUESTED",
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve(["pass", "fail"]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("conflictingDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
                mergeStateStatus: "CLEAN",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("dirtyMergeStateDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
                mergeStateStatus: "DIRTY",
                reviewDecision: null,
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("conflictingAndBehindDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve([]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("approvedAndPassingDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
                reviewDecision: "APPROVED",
                labelNames: [],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve(["pass", "pass"]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("foreignAuthorDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
        github: {
          resolveTokenLogin: () => Promise.resolve("octocat"),
          readRepositoryPrivacy: () => Promise.resolve(true),
          listOpenPullRequests: () =>
            Promise.resolve([
              {
                number: 7,
                title: "Add retry",
                draft: false,
                authorLogin: "hubot",
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
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("noChecksDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("pendingChecksDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
          listCheckBuckets: () => Promise.resolve(["fail", "pending"]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("cancelledChecksDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
          listCheckBuckets: () => Promise.resolve(["cancel", "skipping"]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("passingChecksDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
          listCheckBuckets: () => Promise.resolve(["pass"]),
        },
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("suppressedCiFailureDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
                labelNames: ["needs-human"],
                requestedReviewerLogins: [],
              },
            ]),
          resolvePullAuthor: () => Promise.resolve(null),
          listCheckBuckets: () => Promise.resolve(["fail"]),
        },
        ciSuppressionLabel: "needs-human",
      }),
    )
    .extend("behindDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
        ciSuppressionLabel: undefined,
      }),
    )
    .extend("behindWithFailingCiDrain", () =>
      runStartupDrain({
        login: "octocat",
        mode: "author",
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
          listCheckBuckets: () => Promise.resolve(["fail"]),
        },
        ciSuppressionLabel: undefined,
      }),
    );

  it("変更要求はレビュー提出イベントになる", ({ changesRequestedDrain }) => {
    expect(changesRequestedDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request_review",
        delivery_id: "startup-drain:pull_request_review:7:head-sha:changes_requested",
        payload: {
          action: "submitted",
          pull_request: { number: 7, user: { login: "octocat" } },
          review: { state: "changes_requested", body: "" },
        },
      },
    ]);
  });

  it("CI 失敗はチェックスイートイベントになる", ({ failingCiDrain }) => {
    expect(failingCiDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "check_suite",
        delivery_id: "startup-drain:check_suite:7:head-sha:failure",
        payload: {
          action: "completed",
          check_suite: {
            conclusion: "failure",
            head_sha: "head-sha",
            pull_requests: [{ number: 7 }],
          },
          pull_request: { user: { login: "octocat" } },
        },
      },
    ]);
  });

  it("変更要求と CI 失敗が同時ならレビューが先で CI が後に出る", ({
    changesRequestedWithFailingCiDrain,
  }) => {
    expect(changesRequestedWithFailingCiDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request_review",
        delivery_id: "startup-drain:pull_request_review:7:head-sha:changes_requested",
        payload: {
          action: "submitted",
          pull_request: { number: 7, user: { login: "octocat" } },
          review: { state: "changes_requested", body: "" },
        },
      },
      {
        schema_version: 1,
        event_type: "check_suite",
        delivery_id: "startup-drain:check_suite:7:head-sha:failure",
        payload: {
          action: "completed",
          check_suite: {
            conclusion: "failure",
            head_sha: "head-sha",
            pull_requests: [{ number: 7 }],
          },
          pull_request: { user: { login: "octocat" } },
        },
      },
    ]);
  });

  it("CONFLICTING は衝突イベントになる", ({ conflictingDrain }) => {
    expect(conflictingDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:base-sha:head-sha:merge-conflict",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "CONFLICTING",
            merge_state_status: "DIRTY",
            user: { login: "octocat" },
          },
        },
      },
    ]);
  });

  it("DIRTY も衝突イベントになる", ({ dirtyMergeStateDrain }) => {
    expect(dirtyMergeStateDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:base-sha:head-sha:merge-conflict",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "CONFLICTING",
            merge_state_status: "DIRTY",
            user: { login: "octocat" },
          },
        },
      },
    ]);
  });

  it("衝突と base 遅れは判定式が独立で衝突が先に base 更新が後に出る", ({
    conflictingAndBehindDrain,
  }) => {
    expect(conflictingAndBehindDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:base-sha:head-sha:merge-conflict",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "CONFLICTING",
            merge_state_status: "DIRTY",
            user: { login: "octocat" },
          },
        },
      },
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:base-sha:head-sha:base-update",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "MERGEABLE",
            merge_state_status: "BEHIND",
            user: { login: "octocat" },
          },
        },
      },
    ]);
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

  it("BEHIND は base 更新イベントになる", ({ behindDrain }) => {
    expect(behindDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:base-sha:head-sha:base-update",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "MERGEABLE",
            merge_state_status: "BEHIND",
            user: { login: "octocat" },
          },
        },
      },
    ]);
  });

  it("base 遅れと CI 失敗が同時なら base 更新が先で CI が後に出る", ({
    behindWithFailingCiDrain,
  }) => {
    expect(behindWithFailingCiDrain).toStrictEqual([
      {
        schema_version: 1,
        event_type: "pull_request",
        delivery_id: "startup-drain:pull_request:7:base-sha:head-sha:base-update",
        payload: {
          action: "synchronize",
          pull_request: {
            number: 7,
            mergeable: "MERGEABLE",
            merge_state_status: "BEHIND",
            user: { login: "octocat" },
          },
        },
      },
      {
        schema_version: 1,
        event_type: "check_suite",
        delivery_id: "startup-drain:check_suite:7:head-sha:failure",
        payload: {
          action: "completed",
          check_suite: {
            conclusion: "failure",
            head_sha: "head-sha",
            pull_requests: [{ number: 7 }],
          },
          pull_request: { user: { login: "octocat" } },
        },
      },
    ]);
  });
});
