import { describe, expect, test } from "vite-plus/test";

import {
  mentionedPullNumbers,
  pullRequestAuthorLogin,
  requestedReviewerLogin,
  requestedReviewerLogins,
} from "./extract.ts";

const it = test
  .extend("nestedAuthorLogin", () =>
    pullRequestAuthorLogin({ pull_request: { user: { login: "octocat" } } }))
  .extend("authorLoginWithoutPullRequest", () => pullRequestAuthorLogin({}))
  .extend("authorLoginWithoutUser", () => pullRequestAuthorLogin({ pull_request: { number: 7 } }))
  .extend("authorLoginFromBrokenPullRequest", () =>
    pullRequestAuthorLogin({ pull_request: "broken" }),
  )
  .extend("authorLoginFromNumericLogin", () =>
    pullRequestAuthorLogin({ pull_request: { user: { login: 7 } } }),
  )
  .extend("nestedRequestedReviewerLogin", () =>
    requestedReviewerLogin({ requested_reviewer: { login: "octocat" } }),
  )
  .extend("requestedReviewerLoginWhenAbsent", () => requestedReviewerLogin({}))
  .extend("allRequestedReviewerLogins", () =>
    requestedReviewerLogins({
      pull_request: { requested_reviewers: [{ login: "octocat" }, { login: "hubot" }] },
    }),
  )
  .extend("reviewerLoginsFromNonArray", () =>
    requestedReviewerLogins({ pull_request: { requested_reviewers: "all" } }),
  )
  .extend("reviewerLoginsFromBarePayload", () => requestedReviewerLogins({}))
  .extend("reviewerLoginsSkippingUnnamed", () =>
    requestedReviewerLogins({
      pull_request: { requested_reviewers: [{ login: "octocat" }, { id: 2 }] },
    }),
  )
  .extend("soleMentionedPullNumber", () => mentionedPullNumbers({ pull_request: { number: 7 } }))
  .extend("checkSuitePullNumbers", () =>
    mentionedPullNumbers({ check_suite: { pull_requests: [{ number: 7 }, { number: 8 }] } }),
  )
  .extend("preferredPullRequestNumber", () =>
    mentionedPullNumbers({
      pull_request: { number: 7 },
      check_suite: { pull_requests: [{ number: 8 }] },
    }),
  )
  .extend("pullNumbersFromEmptyCheckSuite", () =>
    mentionedPullNumbers({ check_suite: { pull_requests: [] } }),
  )
  .extend("pullNumbersFromUnrelatedPayload", () =>
    mentionedPullNumbers({ zen: "Design for failure." }),
  )
  .extend("pullNumbersSkippingUnnumbered", () =>
    mentionedPullNumbers({ check_suite: { pull_requests: [{ number: 7 }, { url: "elsewhere" }] } }),
  );

describe("pullRequestAuthorLogin", () => {
  it("pull_request.user.login を返す", ({ nestedAuthorLogin }) => {
    expect(nestedAuthorLogin).toStrictEqual("octocat");
  });

  it("pull_request が無ければ undefined", ({ authorLoginWithoutPullRequest }) => {
    expect(authorLoginWithoutPullRequest).toStrictEqual(undefined);
  });

  it("user が無ければ undefined", ({ authorLoginWithoutUser }) => {
    expect(authorLoginWithoutUser).toStrictEqual(undefined);
  });

  it("pull_request が文字列など非適合でも例外にせず undefined", ({
    authorLoginFromBrokenPullRequest,
  }) => {
    expect(authorLoginFromBrokenPullRequest).toStrictEqual(undefined);
  });

  it("login が文字列でなければ undefined", ({ authorLoginFromNumericLogin }) => {
    expect(authorLoginFromNumericLogin).toStrictEqual(undefined);
  });
});

describe("requestedReviewerLogin", () => {
  it("requested_reviewer.login を返す", ({ nestedRequestedReviewerLogin }) => {
    expect(nestedRequestedReviewerLogin).toStrictEqual("octocat");
  });

  it("requested_reviewer が無ければ undefined", ({ requestedReviewerLoginWhenAbsent }) => {
    expect(requestedReviewerLoginWhenAbsent).toStrictEqual(undefined);
  });
});

describe("requestedReviewerLogins", () => {
  it("現任レビュアー全員のログインを返す", ({ allRequestedReviewerLogins }) => {
    expect(allRequestedReviewerLogins).toStrictEqual(["octocat", "hubot"]);
  });

  it("requested_reviewers が非配列なら空配列", ({ reviewerLoginsFromNonArray }) => {
    expect(reviewerLoginsFromNonArray).toStrictEqual([]);
  });

  it("フィールドが欠けていれば空配列", ({ reviewerLoginsFromBarePayload }) => {
    expect(reviewerLoginsFromBarePayload).toStrictEqual([]);
  });

  it("login を持たない要素は読み飛ばす", ({ reviewerLoginsSkippingUnnamed }) => {
    expect(reviewerLoginsSkippingUnnamed).toStrictEqual(["octocat"]);
  });
});

describe("mentionedPullNumbers", () => {
  it("pull_request.number 単独ならその 1 件", ({ soleMentionedPullNumber }) => {
    expect(soleMentionedPullNumber).toStrictEqual([7]);
  });

  it("check_suite.pull_requests の全件を順に返す", ({ checkSuitePullNumbers }) => {
    expect(checkSuitePullNumbers).toStrictEqual([7, 8]);
  });

  it("両方あれば pull_request.number が優先される", ({ preferredPullRequestNumber }) => {
    expect(preferredPullRequestNumber).toStrictEqual([7]);
  });

  it("check_suite.pull_requests が空なら空配列", ({ pullNumbersFromEmptyCheckSuite }) => {
    expect(pullNumbersFromEmptyCheckSuite).toStrictEqual([]);
  });

  it("どちらも無ければ空配列", ({ pullNumbersFromUnrelatedPayload }) => {
    expect(pullNumbersFromUnrelatedPayload).toStrictEqual([]);
  });

  it("number を持たない要素は読み飛ばす", ({ pullNumbersSkippingUnnumbered }) => {
    expect(pullNumbersSkippingUnnumbered).toStrictEqual([7]);
  });
});
