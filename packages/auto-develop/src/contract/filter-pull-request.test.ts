import { describe, expect, test } from "vite-plus/test";

import { filterPullRequestEvent } from "./filter-pull-request.ts";

const it = test
  .extend("closedForAuthorVerdict", () =>
    filterPullRequestEvent(
      { action: "closed", pull_request: { number: 7 }, delivery_id: "delivery-1" },
      "author",
    ))
  .extend("closedForReviewerVerdict", () =>
    filterPullRequestEvent({ action: "closed", pull_request: { number: 7 } }, "reviewer"),
  )
  .extend("excludeLabelAddedVerdict", () =>
    filterPullRequestEvent(
      {
        action: "labeled",
        pull_request: { number: 7 },
        label: { name: "exclude-auto-develop" },
        delivery_id: "delivery-1",
      },
      "reviewer",
    ),
  )
  .extend("otherLabelAddedVerdict", () =>
    filterPullRequestEvent(
      { action: "labeled", pull_request: { number: 7 }, label: { name: "bug" } },
      "reviewer",
    ),
  )
  .extend("excludeLabelledSynchronizeVerdict", () =>
    filterPullRequestEvent(
      {
        action: "synchronize",
        pull_request: { number: 7 },
        label: { name: "exclude-auto-develop" },
      },
      "reviewer",
    ),
  )
  .extend("otherLabelWithDirtyStateVerdict", () =>
    filterPullRequestEvent(
      {
        action: "labeled",
        pull_request: { number: 7, merge_state_status: "DIRTY" },
        label: { name: "bug" },
      },
      "author",
    ),
  )
  .extend("excludeLabelRemovedVerdict", () =>
    filterPullRequestEvent(
      {
        action: "unlabeled",
        pull_request: { number: 7, title: "Add retry", draft: false },
        label: { name: "exclude-auto-develop" },
      },
      "reviewer",
    ),
  )
  .extend("bareExcludeLabelRemovedVerdict", () =>
    filterPullRequestEvent(
      {
        action: "unlabeled",
        pull_request: { number: 7 },
        label: { name: "exclude-auto-develop" },
      },
      "reviewer",
    ),
  )
  .extend("excludeLabelRemovedForAuthorVerdict", () =>
    filterPullRequestEvent(
      {
        action: "unlabeled",
        pull_request: { number: 7 },
        label: { name: "exclude-auto-develop" },
      },
      "author",
    ),
  )
  .extend("otherLabelRemovedVerdict", () =>
    filterPullRequestEvent(
      { action: "unlabeled", pull_request: { number: 7 }, label: { name: "bug" } },
      "reviewer",
    ),
  )
  .extend("synchronizeForReviewerVerdict", () =>
    filterPullRequestEvent(
      { action: "synchronize", pull_request: { number: 7 }, delivery_id: "delivery-1" },
      "reviewer",
    ),
  )
  .extend("baseChangedEditVerdict", () =>
    filterPullRequestEvent(
      { action: "edited", changes: { base: {} }, pull_request: { number: 7 } },
      "reviewer",
    ),
  )
  .extend("titleChangedEditVerdict", () =>
    filterPullRequestEvent(
      { action: "edited", changes: { title: { from: "Old" } }, pull_request: { number: 7 } },
      "reviewer",
    ),
  )
  .extend("changelessEditVerdict", () =>
    filterPullRequestEvent({ action: "edited", pull_request: { number: 7 } }, "reviewer"),
  )
  .extend("detailedReviewRequestVerdict", () =>
    filterPullRequestEvent(
      {
        action: "review_requested",
        pull_request: { number: 7, title: "Add retry", draft: true },
        requested_reviewer: { login: "octocat" },
      },
      "reviewer",
    ),
  )
  .extend("bareReviewRequestVerdict", () =>
    filterPullRequestEvent({ action: "review_requested", pull_request: { number: 7 } }, "reviewer"),
  )
  .extend("booleanMergeableReviewRequestVerdict", () =>
    filterPullRequestEvent(
      { action: "review_requested", pull_request: { number: 7, mergeable: true } },
      "reviewer",
    ),
  )
  .extend("openedForReviewerVerdict", () =>
    filterPullRequestEvent({ action: "opened", pull_request: { number: 7 } }, "reviewer"),
  )
  .extend("reviewRequestForAuthorVerdict", () =>
    filterPullRequestEvent({ action: "review_requested", pull_request: { number: 7 } }, "author"),
  )
  .extend("conflictingSynchronizeVerdict", () =>
    filterPullRequestEvent(
      {
        action: "synchronize",
        pull_request: { number: 7, mergeable: "CONFLICTING", merge_state_status: "DIRTY" },
      },
      "author",
    ),
  )
  .extend("behindSynchronizeVerdict", () =>
    filterPullRequestEvent(
      {
        action: "synchronize",
        pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
      },
      "author",
    ),
  )
  .extend("neutralMergeStateVerdict", () =>
    filterPullRequestEvent({ action: "opened", pull_request: { number: 7 } }, "author"),
  )
  .extend("nullPullRequestVerdict", () =>
    filterPullRequestEvent({ action: "closed", pull_request: null }, "reviewer"),
  )
  .extend("unnumberedPullRequestVerdict", () =>
    filterPullRequestEvent({ action: "closed", pull_request: { title: "Add retry" } }, "reviewer"),
  )
  .extend("actionlessEventVerdict", () =>
    filterPullRequestEvent({ pull_request: { number: 7 } }, "reviewer"),
  );

describe("モード非依存の選別", () => {
  it("closed は pr-closed になり delivery_id を引き継ぐ", ({ closedForAuthorVerdict }) => {
    expect(closedForAuthorVerdict).toStrictEqual({
      kind: "pr-closed",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("closed は reviewer モードでも pr-closed になる", ({ closedForReviewerVerdict }) => {
    expect(closedForReviewerVerdict).toStrictEqual({ kind: "pr-closed", pullNumber: 7 });
  });

  it("除外ラベルの付与は pr-excluded になる", ({ excludeLabelAddedVerdict }) => {
    expect(excludeLabelAddedVerdict).toStrictEqual({
      kind: "pr-excluded",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("別のラベル付与は除外として終端せず後続判定で不採用になる", ({ otherLabelAddedVerdict }) => {
    expect(otherLabelAddedVerdict).toStrictEqual(null);
  });

  it("除外ラベルが付いたままの synchronize はラベル判定で終端せず後続判定へ落ちる", ({
    excludeLabelledSynchronizeVerdict,
  }) => {
    expect(excludeLabelledSynchronizeVerdict).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: 7,
    });
  });

  it("別のラベル付与でもマージ状態が立っていれば author では merge-conflict になる", ({
    otherLabelWithDirtyStateVerdict,
  }) => {
    expect(otherLabelWithDirtyStateVerdict).toStrictEqual({
      kind: "merge-conflict",
      pullNumber: 7,
    });
  });
});

describe("除外ラベルの解除", () => {
  it("reviewer では review-requested を合成し title と draft を引き継ぐ", ({
    excludeLabelRemovedVerdict,
  }) => {
    expect(excludeLabelRemovedVerdict).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
      title: "Add retry",
      draft: false,
    });
  });

  it("reviewer で title と draft が無ければ番号のみになる", ({
    bareExcludeLabelRemovedVerdict,
  }) => {
    expect(bareExcludeLabelRemovedVerdict).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
    });
  });

  it("author では不採用になる", ({ excludeLabelRemovedForAuthorVerdict }) => {
    expect(excludeLabelRemovedForAuthorVerdict).toStrictEqual(null);
  });

  it("別ラベルの解除は除外解除として終端せず不採用になる", ({ otherLabelRemovedVerdict }) => {
    expect(otherLabelRemovedVerdict).toStrictEqual(null);
  });
});

describe("reviewer モードの選別", () => {
  it("synchronize は head 側の入力変更になる", ({ synchronizeForReviewerVerdict }) => {
    expect(synchronizeForReviewerVerdict).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: 7,
      deliveryId: "delivery-1",
    });
  });

  it("edited と changes.base の存在は base 側の入力変更になる", ({ baseChangedEditVerdict }) => {
    expect(baseChangedEditVerdict).toStrictEqual({
      kind: "review-input-changed",
      changedInput: "base",
      pullNumber: 7,
    });
  });

  it("changes.title だけの edited は不採用になる", ({ titleChangedEditVerdict }) => {
    expect(titleChangedEditVerdict).toStrictEqual(null);
  });

  it("changes を持たない edited は不採用になる", ({ changelessEditVerdict }) => {
    expect(changelessEditVerdict).toStrictEqual(null);
  });

  it("review_requested は依頼先と title と draft を引き継ぐ", ({
    detailedReviewRequestVerdict,
  }) => {
    expect(detailedReviewRequestVerdict).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
      reviewerLogin: "octocat",
      title: "Add retry",
      draft: true,
    });
  });

  it("review_requested の最小形は種別と番号だけになる", ({ bareReviewRequestVerdict }) => {
    expect(bareReviewRequestVerdict).toStrictEqual({ kind: "review-requested", pullNumber: 7 });
  });

  it("mergeable が文字列でない値でも review_requested の採用を妨げない", ({
    booleanMergeableReviewRequestVerdict,
  }) => {
    expect(booleanMergeableReviewRequestVerdict).toStrictEqual({
      kind: "review-requested",
      pullNumber: 7,
    });
  });

  it("opened は不採用になる", ({ openedForReviewerVerdict }) => {
    expect(openedForReviewerVerdict).toStrictEqual(null);
  });
});

describe("author モードの選別", () => {
  it("review_requested は不採用になる", ({ reviewRequestForAuthorVerdict }) => {
    expect(reviewRequestForAuthorVerdict).toStrictEqual(null);
  });

  it("CONFLICTING と DIRTY の synchronize は merge-conflict になる", ({
    conflictingSynchronizeVerdict,
  }) => {
    expect(conflictingSynchronizeVerdict).toStrictEqual({ kind: "merge-conflict", pullNumber: 7 });
  });

  it("MERGEABLE と BEHIND の synchronize は base-update になる", ({ behindSynchronizeVerdict }) => {
    expect(behindSynchronizeVerdict).toStrictEqual({ kind: "base-update", pullNumber: 7 });
  });

  it("マージ状態が中立なら不採用になる", ({ neutralMergeStateVerdict }) => {
    expect(neutralMergeStateVerdict).toStrictEqual(null);
  });
});

describe("構造要件", () => {
  it("pull_request が null なら不採用になる", ({ nullPullRequestVerdict }) => {
    expect(nullPullRequestVerdict).toStrictEqual(null);
  });

  it("number が欠けていれば不採用になる", ({ unnumberedPullRequestVerdict }) => {
    expect(unnumberedPullRequestVerdict).toStrictEqual(null);
  });

  it("action が文字列でなければ不採用になる", ({ actionlessEventVerdict }) => {
    expect(actionlessEventVerdict).toStrictEqual(null);
  });
});
