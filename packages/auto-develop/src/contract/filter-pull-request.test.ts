import { describe, expect, test } from "vite-plus/test";

import { filterPullRequestEvent } from "./filter-pull-request.ts";

describe("モード非依存の選別", () => {
  test("closed は pr-closed になり delivery_id を引き継ぐ", () => {
    const event = { action: "closed", pull_request: { number: 7 }, delivery_id: "delivery-1" };
    expect(filterPullRequestEvent(event, "author")).toStrictEqual({
      kind: "pr-closed",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  test("closed は reviewer モードでも pr-closed になる", () => {
    const event = { action: "closed", pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "pr-closed",
      pullNumber: 7,
    });
  });

  test("除外ラベルの付与は pr-excluded になる", () => {
    const event = {
      action: "labeled",
      pull_request: { number: 7 },
      label: { name: "exclude-auto-develop" },
      delivery_id: "delivery-1",
    };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "pr-excluded",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  test("別のラベル付与は除外として終端せず後続判定で不採用になる", () => {
    const event = { action: "labeled", pull_request: { number: 7 }, label: { name: "bug" } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });

  test("除外ラベルが付いたままの synchronize はラベル判定で終端せず後続判定へ落ちる", () => {
    const event = {
      action: "synchronize",
      pull_request: { number: 7 },
      label: { name: "exclude-auto-develop" },
    };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: 7,
    });
  });

  test("別のラベル付与でもマージ状態が立っていれば author では merge-conflict になる", () => {
    const event = {
      action: "labeled",
      pull_request: { number: 7, merge_state_status: "DIRTY" },
      label: { name: "bug" },
    };
    expect(filterPullRequestEvent(event, "author")).toStrictEqual({
      kind: "merge-conflict",
      pullNumber: 7,
    });
  });
});

describe("除外ラベルの解除", () => {
  test("reviewer では review-requested を合成し title と draft を引き継ぐ", () => {
    const event = {
      action: "unlabeled",
      pull_request: { number: 7, title: "Add retry", draft: false },
      label: { name: "exclude-auto-develop" },
    };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
      title: "Add retry",
      draft: false,
    });
  });

  test("reviewer で title と draft が無ければ番号のみになる", () => {
    const event = {
      action: "unlabeled",
      pull_request: { number: 7 },
      label: { name: "exclude-auto-develop" },
    };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
    });
  });

  test("author では不採用になる", () => {
    const event = {
      action: "unlabeled",
      pull_request: { number: 7 },
      label: { name: "exclude-auto-develop" },
    };
    expect(filterPullRequestEvent(event, "author")).toStrictEqual(null);
  });

  test("別ラベルの解除は除外解除として終端せず不採用になる", () => {
    const event = { action: "unlabeled", pull_request: { number: 7 }, label: { name: "bug" } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });
});

describe("reviewer モードの選別", () => {
  test("synchronize は head 側の入力変更になる", () => {
    const event = { action: "synchronize", pull_request: { number: 7 }, delivery_id: "delivery-1" };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  test("edited と changes.base の存在は base 側の入力変更になる", () => {
    const event = { action: "edited", changes: { base: {} }, pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "base",
      pullNumber: 7,
    });
  });

  test("changes.title だけの edited は不採用になる", () => {
    const event = {
      action: "edited",
      changes: { title: { from: "Old" } },
      pull_request: { number: 7 },
    };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });

  test("changes を持たない edited は不採用になる", () => {
    const event = { action: "edited", pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });

  test("review_requested は依頼先と title と draft を引き継ぐ", () => {
    const event = {
      action: "review_requested",
      pull_request: { number: 7, title: "Add retry", draft: true },
      requested_reviewer: { login: "octocat" },
    };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
      reviewerLogin: "octocat",
      title: "Add retry",
      draft: true,
    });
  });

  test("review_requested の最小形は種別と番号だけになる", () => {
    const event = { action: "review_requested", pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
    });
  });

  test("mergeable が文字列でない値でも review_requested の採用を妨げない", () => {
    const event = { action: "review_requested", pull_request: { number: 7, mergeable: true } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
    });
  });

  test("opened は不採用になる", () => {
    const event = { action: "opened", pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });
});

describe("author モードの選別", () => {
  test("review_requested は不採用になる", () => {
    const event = { action: "review_requested", pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "author")).toStrictEqual(null);
  });

  test("CONFLICTING と DIRTY の synchronize は merge-conflict になる", () => {
    const event = {
      action: "synchronize",
      pull_request: { number: 7, mergeable: "CONFLICTING", merge_state_status: "DIRTY" },
    };
    expect(filterPullRequestEvent(event, "author")).toStrictEqual({
      kind: "merge-conflict",
      pullNumber: 7,
    });
  });

  test("MERGEABLE と BEHIND の synchronize は base-update になる", () => {
    const event = {
      action: "synchronize",
      pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
    };
    expect(filterPullRequestEvent(event, "author")).toStrictEqual({
      kind: "base-update",
      pullNumber: 7,
    });
  });

  test("マージ状態が中立なら不採用になる", () => {
    const event = { action: "opened", pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "author")).toStrictEqual(null);
  });
});

describe("構造要件", () => {
  test("pull_request が null なら不採用になる", () => {
    const event = { action: "closed", pull_request: null };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });

  test("number が欠けていれば不採用になる", () => {
    const event = { action: "closed", pull_request: { title: "Add retry" } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });

  test("action が文字列でなければ不採用になる", () => {
    const event = { pull_request: { number: 7 } };
    expect(filterPullRequestEvent(event, "reviewer")).toStrictEqual(null);
  });
});
