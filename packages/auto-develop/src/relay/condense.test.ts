import { describe, expect, test } from "vite-plus/test";

import { condenseWebhookPayload } from "./condense.ts";

describe("pull_request の縮約", () => {
  test("本文や URL 群は落ち、判定に必要な最小構造だけ残る", () => {
    const payload = {
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
    };
    expect(condenseWebhookPayload({ eventType: "pull_request", payload })).toStrictEqual({
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

  test("labels と requested_reviewers は空配列なら省略される", () => {
    const payload = {
      action: "opened",
      pull_request: { number: 7, user: { login: "octocat" }, labels: [], requested_reviewers: [] },
    };
    expect(condenseWebhookPayload({ eventType: "pull_request", payload })).toStrictEqual({
      action: "opened",
      pull_request: { number: 7, user: { login: "octocat" } },
    });
  });

  test("changes は base の存在マーカーだけ残り他フィールドは落ちる", () => {
    const payload = {
      action: "edited",
      changes: { base: { ref: { from: "main" } }, body: { from: "old" } },
      pull_request: { number: 7 },
    };
    expect(condenseWebhookPayload({ eventType: "pull_request", payload })).toStrictEqual({
      action: "edited",
      changes: { base: {} },
      pull_request: { number: 7 },
    });
  });

  test("labeled の対象ラベルは name だけ残る", () => {
    const payload = {
      action: "labeled",
      pull_request: { number: 7 },
      label: { name: "exclude-auto-develop", color: "black" },
    };
    expect(condenseWebhookPayload({ eventType: "pull_request", payload })).toStrictEqual({
      action: "labeled",
      pull_request: { number: 7 },
      label: { name: "exclude-auto-develop" },
    });
  });

  test("name を持たないラベル要素は読み飛ばされ空なら省略される", () => {
    const payload = {
      action: "labeled",
      pull_request: { number: 7, labels: [{ color: "red" }] },
    };
    expect(condenseWebhookPayload({ eventType: "pull_request", payload })).toStrictEqual({
      action: "labeled",
      pull_request: { number: 7 },
    });
  });

  test("number も user も無い pull_request は空のまま残る", () => {
    const payload = { action: "opened", pull_request: { user: { id: 1 } } };
    expect(condenseWebhookPayload({ eventType: "pull_request", payload })).toStrictEqual({
      action: "opened",
      pull_request: {},
    });
  });

  test("pull_request 自体が無ければ action だけ残る", () => {
    expect(
      condenseWebhookPayload({ eventType: "pull_request", payload: { action: "opened" } }),
    ).toStrictEqual({
      action: "opened",
    });
  });
});

describe("pull_request_review の縮約", () => {
  test("review は body と state だけ残る", () => {
    const payload = {
      action: "submitted",
      pull_request: { number: 7, user: { login: "octocat" }, head: { ref: "topic" } },
      review: {
        body: "Fix the tests.",
        state: "changes_requested",
        html_url: "https://example.test",
      },
    };
    expect(condenseWebhookPayload({ eventType: "pull_request_review", payload })).toStrictEqual({
      action: "submitted",
      pull_request: { number: 7, user: { login: "octocat" } },
      review: { body: "Fix the tests.", state: "changes_requested" },
    });
  });

  test("pull_request が無ければ action と review だけ残る", () => {
    const payload = { action: "submitted", review: { body: null, state: "approved" } };
    expect(condenseWebhookPayload({ eventType: "pull_request_review", payload })).toStrictEqual({
      action: "submitted",
      review: { body: null, state: "approved" },
    });
  });

  test("number も user も無い pull_request は空のまま残り review が無ければ落ちる", () => {
    const payload = { action: "submitted", pull_request: { id: 1 } };
    expect(condenseWebhookPayload({ eventType: "pull_request_review", payload })).toStrictEqual({
      action: "submitted",
      pull_request: {},
    });
  });
});

describe("check_suite の縮約", () => {
  test("conclusion と head_sha と pull_requests だけ残る", () => {
    const payload = {
      action: "completed",
      check_suite: {
        id: 99,
        app: { name: "ci" },
        conclusion: "failure",
        head_sha: "0a1b2c3",
        pull_requests: [{ number: 7, url: "https://example.test" }],
      },
    };
    expect(condenseWebhookPayload({ eventType: "check_suite", payload })).toStrictEqual({
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
    });
  });

  test("check_suite が無ければ action だけ残る", () => {
    expect(
      condenseWebhookPayload({ eventType: "check_suite", payload: { action: "completed" } }),
    ).toStrictEqual({ action: "completed" });
  });

  test("pull_requests が配列でなければ空配列になる", () => {
    const payload = {
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: "none" },
    };
    expect(condenseWebhookPayload({ eventType: "check_suite", payload })).toStrictEqual({
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [] },
    });
  });

  test("number を持たない pull_requests 要素は読み飛ばされる", () => {
    const payload = {
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ id: 1 }] },
    };
    expect(condenseWebhookPayload({ eventType: "check_suite", payload })).toStrictEqual({
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [] },
    });
  });
});

describe("未知種別の縮約", () => {
  test("action だけの縮約になる", () => {
    expect(
      condenseWebhookPayload({ eventType: "push", payload: { ref: "refs/heads/main" } }),
    ).toStrictEqual({
      action: undefined,
    });
  });
});
