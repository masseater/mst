import { describe, expect, test } from "vite-plus/test";

import {
  mentionedPullNumbers,
  pullRequestAuthorLogin,
  requestedReviewerLogin,
  requestedReviewerLogins,
} from "./extract.ts";

describe("pullRequestAuthorLogin", () => {
  test("pull_request.user.login を返す", () => {
    expect(pullRequestAuthorLogin({ pull_request: { user: { login: "octocat" } } })).toStrictEqual(
      "octocat",
    );
  });

  test("pull_request が無ければ undefined", () => {
    expect(pullRequestAuthorLogin({})).toStrictEqual(undefined);
  });

  test("user が無ければ undefined", () => {
    expect(pullRequestAuthorLogin({ pull_request: { number: 7 } })).toStrictEqual(undefined);
  });

  test("pull_request が文字列など非適合でも例外にせず undefined", () => {
    expect(pullRequestAuthorLogin({ pull_request: "broken" })).toStrictEqual(undefined);
  });

  test("login が文字列でなければ undefined", () => {
    expect(pullRequestAuthorLogin({ pull_request: { user: { login: 7 } } })).toStrictEqual(
      undefined,
    );
  });
});

describe("requestedReviewerLogin", () => {
  test("requested_reviewer.login を返す", () => {
    expect(requestedReviewerLogin({ requested_reviewer: { login: "octocat" } })).toStrictEqual(
      "octocat",
    );
  });

  test("requested_reviewer が無ければ undefined", () => {
    expect(requestedReviewerLogin({})).toStrictEqual(undefined);
  });
});

describe("requestedReviewerLogins", () => {
  test("現任レビュアー全員のログインを返す", () => {
    const payload = {
      pull_request: { requested_reviewers: [{ login: "octocat" }, { login: "hubot" }] },
    };
    expect(requestedReviewerLogins(payload)).toStrictEqual(["octocat", "hubot"]);
  });

  test("requested_reviewers が非配列なら空配列", () => {
    expect(requestedReviewerLogins({ pull_request: { requested_reviewers: "all" } })).toStrictEqual(
      [],
    );
  });

  test("フィールドが欠けていれば空配列", () => {
    expect(requestedReviewerLogins({})).toStrictEqual([]);
  });

  test("login を持たない要素は読み飛ばす", () => {
    const payload = {
      pull_request: { requested_reviewers: [{ login: "octocat" }, { id: 2 }] },
    };
    expect(requestedReviewerLogins(payload)).toStrictEqual(["octocat"]);
  });
});

describe("mentionedPullNumbers", () => {
  test("pull_request.number 単独ならその 1 件", () => {
    expect(mentionedPullNumbers({ pull_request: { number: 7 } })).toStrictEqual([7]);
  });

  test("check_suite.pull_requests の全件を順に返す", () => {
    const payload = { check_suite: { pull_requests: [{ number: 7 }, { number: 8 }] } };
    expect(mentionedPullNumbers(payload)).toStrictEqual([7, 8]);
  });

  test("両方あれば pull_request.number が優先される", () => {
    const payload = {
      pull_request: { number: 7 },
      check_suite: { pull_requests: [{ number: 8 }] },
    };
    expect(mentionedPullNumbers(payload)).toStrictEqual([7]);
  });

  test("check_suite.pull_requests が空なら空配列", () => {
    expect(mentionedPullNumbers({ check_suite: { pull_requests: [] } })).toStrictEqual([]);
  });

  test("どちらも無ければ空配列", () => {
    expect(mentionedPullNumbers({ zen: "Design for failure." })).toStrictEqual([]);
  });

  test("number を持たない要素は読み飛ばす", () => {
    const payload = { check_suite: { pull_requests: [{ number: 7 }, { url: "elsewhere" }] } };
    expect(mentionedPullNumbers(payload)).toStrictEqual([7]);
  });
});
