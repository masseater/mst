import { describe, expect, test } from "vite-plus/test";

import { condenseWebhookPayload } from "./condense.ts";

const it = test
  .extend("condensedReviewRequest", () =>
    condenseWebhookPayload({
      eventType: "pull_request",
      payload: {
        action: "review_requested",
        pull_request: {
          number: 7,
          body: "A very long description.",
          diff_url: "https://example.test/diff",
          user: { login: "octocat", id: 1 },
          mergeable: "MERGEABLE",
          merge_state_status: "CLEAN",
          labels: [{ name: "bug", color: "red" }],
          requested_reviewers: [{ login: "hubot", id: 2 }],
        },
        requested_reviewer: { login: "hubot", id: 2 },
        sender: { login: "octocat" },
        repository: { id: 1, full_name: "example-org/example-repo" },
      },
    }))
  .extend("condensedEmptyCollections", () =>
    condenseWebhookPayload({
      eventType: "pull_request",
      payload: {
        action: "opened",
        pull_request: {
          number: 7,
          user: { login: "octocat" },
          labels: [],
          requested_reviewers: [],
        },
      },
    }),
  )
  .extend("condensedBaseChange", () =>
    condenseWebhookPayload({
      eventType: "pull_request",
      payload: {
        action: "edited",
        changes: { base: { ref: { from: "main" } }, body: { from: "old" } },
        pull_request: { number: 7 },
      },
    }),
  )
  .extend("condensedLabeledEvent", () =>
    condenseWebhookPayload({
      eventType: "pull_request",
      payload: {
        action: "labeled",
        pull_request: { number: 7 },
        label: { name: "exclude-auto-develop", color: "black" },
      },
    }),
  )
  .extend("condensedNamelessLabel", () =>
    condenseWebhookPayload({
      eventType: "pull_request",
      payload: {
        action: "labeled",
        pull_request: { number: 7, labels: [{ color: "red" }] },
      },
    }),
  )
  .extend("condensedAnonymousPull", () =>
    condenseWebhookPayload({
      eventType: "pull_request",
      payload: { action: "opened", pull_request: { user: { id: 1 } } },
    }),
  )
  .extend("condensedPullless", () =>
    condenseWebhookPayload({ eventType: "pull_request", payload: { action: "opened" } }),
  )
  .extend("condensedSubmittedReview", () =>
    condenseWebhookPayload({
      eventType: "pull_request_review",
      payload: {
        action: "submitted",
        pull_request: { number: 7, user: { login: "octocat" }, head: { ref: "topic" } },
        review: {
          body: "Fix the tests.",
          state: "changes_requested",
          html_url: "https://example.test",
        },
      },
    }),
  )
  .extend("condensedPullessReview", () =>
    condenseWebhookPayload({
      eventType: "pull_request_review",
      payload: { action: "submitted", review: { body: null, state: "approved" } },
    }),
  )
  .extend("condensedReviewlessPull", () =>
    condenseWebhookPayload({
      eventType: "pull_request_review",
      payload: { action: "submitted", pull_request: { id: 1 } },
    }),
  )
  .extend("condensedCheckSuite", () =>
    condenseWebhookPayload({
      eventType: "check_suite",
      payload: {
        action: "completed",
        check_suite: {
          id: 99,
          app: { name: "ci" },
          conclusion: "failure",
          head_sha: "0a1b2c3",
          pull_requests: [{ number: 7, url: "https://example.test" }],
        },
      },
    }),
  )
  .extend("condensedSuiteless", () =>
    condenseWebhookPayload({ eventType: "check_suite", payload: { action: "completed" } }),
  )
  .extend("condensedNonArrayPullRequests", () =>
    condenseWebhookPayload({
      eventType: "check_suite",
      payload: {
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: "none" },
      },
    }),
  )
  .extend("condensedNumberlessPullRequests", () =>
    condenseWebhookPayload({
      eventType: "check_suite",
      payload: {
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ id: 1 }] },
      },
    }),
  )
  .extend("condensedUnknownEvent", () =>
    condenseWebhookPayload({ eventType: "push", payload: { ref: "refs/heads/main" } }),
  );

describe("pull_request の縮約", () => {
  it("本文や URL 群は落ち、判定に必要な最小構造だけ残る", ({ condensedReviewRequest }) => {
    expect(condensedReviewRequest).toStrictEqual({
      action: "review_requested",
      pull_request: {
        number: 7,
        user: { login: "octocat" },
        mergeable: "MERGEABLE",
        merge_state_status: "CLEAN",
        labels: [{ name: "bug" }],
        requested_reviewers: [{ login: "hubot" }],
      },
      requested_reviewer: { login: "hubot" },
    });
  });

  it("labels と requested_reviewers は空配列なら省略される", ({ condensedEmptyCollections }) => {
    expect(condensedEmptyCollections).toStrictEqual({
      action: "opened",
      pull_request: { number: 7, user: { login: "octocat" } },
    });
  });

  it("changes は base の存在マーカーだけ残り他フィールドは落ちる", ({ condensedBaseChange }) => {
    expect(condensedBaseChange).toStrictEqual({
      action: "edited",
      changes: { base: {} },
      pull_request: { number: 7 },
    });
  });

  it("labeled の対象ラベルは name だけ残る", ({ condensedLabeledEvent }) => {
    expect(condensedLabeledEvent).toStrictEqual({
      action: "labeled",
      pull_request: { number: 7 },
      label: { name: "exclude-auto-develop" },
    });
  });

  it("name を持たないラベル要素は読み飛ばされ空なら省略される", ({ condensedNamelessLabel }) => {
    expect(condensedNamelessLabel).toStrictEqual({
      action: "labeled",
      pull_request: { number: 7 },
    });
  });

  it("number も user も無い pull_request は空のまま残る", ({ condensedAnonymousPull }) => {
    expect(condensedAnonymousPull).toStrictEqual({ action: "opened", pull_request: {} });
  });

  it("pull_request 自体が無ければ action だけ残る", ({ condensedPullless }) => {
    expect(condensedPullless).toStrictEqual({ action: "opened" });
  });
});

describe("pull_request_review の縮約", () => {
  it("review は body と state だけ残る", ({ condensedSubmittedReview }) => {
    expect(condensedSubmittedReview).toStrictEqual({
      action: "submitted",
      pull_request: { number: 7, user: { login: "octocat" } },
      review: { body: "Fix the tests.", state: "changes_requested" },
    });
  });

  it("pull_request が無ければ action と review だけ残る", ({ condensedPullessReview }) => {
    expect(condensedPullessReview).toStrictEqual({
      action: "submitted",
      review: { body: null, state: "approved" },
    });
  });

  it("number も user も無い pull_request は空のまま残り review が無ければ落ちる", ({
    condensedReviewlessPull,
  }) => {
    expect(condensedReviewlessPull).toStrictEqual({ action: "submitted", pull_request: {} });
  });
});

describe("check_suite の縮約", () => {
  it("conclusion と head_sha と pull_requests だけ残る", ({ condensedCheckSuite }) => {
    expect(condensedCheckSuite).toStrictEqual({
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
    });
  });

  it("check_suite が無ければ action だけ残る", ({ condensedSuiteless }) => {
    expect(condensedSuiteless).toStrictEqual({ action: "completed" });
  });

  it("pull_requests が配列でなければ空配列になる", ({ condensedNonArrayPullRequests }) => {
    expect(condensedNonArrayPullRequests).toStrictEqual({
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [] },
    });
  });

  it("number を持たない pull_requests 要素は読み飛ばされる", ({
    condensedNumberlessPullRequests,
  }) => {
    expect(condensedNumberlessPullRequests).toStrictEqual({
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [] },
    });
  });
});

describe("未知種別の縮約", () => {
  it("action だけの縮約になる", ({ condensedUnknownEvent }) => {
    expect(condensedUnknownEvent).toStrictEqual({ action: undefined });
  });
});
