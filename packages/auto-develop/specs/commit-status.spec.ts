import { describe, expect, it } from "vite-plus/test";

import { changedEndpoint } from "../src/lifecycle/input-change.ts";
import {
  effectiveReviewOf,
  reviewVerdictState,
  type Review,
} from "../src/lifecycle/review-verdict.ts";

const review = (overrides: Partial<Review>): Review => ({
  state: "APPROVED",
  body: "",
  submittedAt: "2026-08-11T00:00:00.000Z",
  commitSha: "sha-1",
  authorLogin: "review-bot",
  ...overrides,
});

describe("コミットステータスは PR の現在の入力に対する結果を表す", () => {
  it("base はブランチ名の変化で入力の変更とみなす", () => {
    expect(
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "develop", headRefOid: "abc" },
      }),
    ).toStrictEqual("base");
  });

  it("base ブランチが同名のまま前進しても入力は変わっていない", () => {
    expect(
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "main", headRefOid: "abc" },
      }),
    ).toStrictEqual(null);
  });

  it("head はコミット SHA の変化で入力の変更とみなす", () => {
    expect(
      changedEndpoint({
        before: { baseRefName: "main", headRefOid: "abc" },
        after: { baseRefName: "main", headRefOid: "def" },
      }),
    ).toStrictEqual("head");
  });

  it("直近の実効レビューが変更要求ならステータスは error になる", () => {
    expect(reviewVerdictState(review({ state: "CHANGES_REQUESTED" }))).toStrictEqual("error");
  });

  it("直近の実効レビューが承認ならステータスは success になる", () => {
    expect(reviewVerdictState(review({ state: "APPROVED" }))).toStrictEqual("success");
  });

  it("実効レビューが一度も無ければステータスは success へ倒す", () => {
    expect(reviewVerdictState(null)).toStrictEqual("success");
  });

  it("コメントのみのレビューは判定に数えない", () => {
    const reviews = [review({ state: "APPROVED" }), review({ state: "COMMENTED" })];
    expect(effectiveReviewOf({ reviews, login: "review-bot" })?.state).toStrictEqual("APPROVED");
  });

  it("代理ログイン以外が出したレビューは判定に数えない", () => {
    const reviews = [review({ state: "CHANGES_REQUESTED", authorLogin: "human" })];
    expect(effectiveReviewOf({ reviews, login: "review-bot" })).toStrictEqual(null);
  });
});
