import { describe, expect, test } from "vite-plus/test";

import {
  indicatesBehindBase,
  indicatesMergeConflict,
  isAuthorWorkConclusion,
  isAuthorWorkReviewState,
  isCheckSuiteConclusion,
  isMode,
  isReviewState,
} from "./vocabulary.ts";

describe("isMode", () => {
  const it = test
    .extend("authorIsMode", () => isMode("author"))
    .extend("observerIsMode", () => isMode("observer"));

  it("author はモードとして認められる", ({ authorIsMode }) => {
    expect(authorIsMode).toStrictEqual(true);
  });

  it("語彙外の文字列はモードではない", ({ observerIsMode }) => {
    expect(observerIsMode).toStrictEqual(false);
  });
});

describe("isReviewState", () => {
  const it = test
    .extend("changesRequestedIsReviewState", () => isReviewState("changes_requested"))
    .extend("dismissedIsReviewState", () => isReviewState("dismissed"));

  it("changes_requested はレビュー判定語彙に含まれる", ({ changesRequestedIsReviewState }) => {
    expect(changesRequestedIsReviewState).toStrictEqual(true);
  });

  it("dismissed は語彙外になる", ({ dismissedIsReviewState }) => {
    expect(dismissedIsReviewState).toStrictEqual(false);
  });
});

describe("isAuthorWorkReviewState", () => {
  const it = test
    .extend("changesRequestedStartsAuthorWork", () => isAuthorWorkReviewState("changes_requested"))
    .extend("approvedStartsAuthorWork", () => isAuthorWorkReviewState("approved"));

  it("changes_requested だけが著者作業を起動する", ({ changesRequestedStartsAuthorWork }) => {
    expect(changesRequestedStartsAuthorWork).toStrictEqual(true);
  });

  it("approved は著者作業を起動しない", ({ approvedStartsAuthorWork }) => {
    expect(approvedStartsAuthorWork).toStrictEqual(false);
  });
});

describe("isCheckSuiteConclusion", () => {
  const it = test
    .extend("startupFailureIsCheckSuiteConclusion", () => isCheckSuiteConclusion("startup_failure"))
    .extend("nullIsCheckSuiteConclusion", () => isCheckSuiteConclusion(null));

  it("startup_failure は check suite 特有の結論として認められる", ({
    startupFailureIsCheckSuiteConclusion,
  }) => {
    expect(startupFailureIsCheckSuiteConclusion).toStrictEqual(true);
  });

  it("null は語彙外になる", ({ nullIsCheckSuiteConclusion }) => {
    expect(nullIsCheckSuiteConclusion).toStrictEqual(false);
  });
});

describe("isAuthorWorkConclusion", () => {
  const it = test
    .extend("timedOutStartsAuthorWork", () => isAuthorWorkConclusion("timed_out"))
    .extend("successStartsAuthorWork", () => isAuthorWorkConclusion("success"));

  it("timed_out は著者作業を起動する", ({ timedOutStartsAuthorWork }) => {
    expect(timedOutStartsAuthorWork).toStrictEqual(true);
  });

  it("success は著者作業を起動しない", ({ successStartsAuthorWork }) => {
    expect(successStartsAuthorWork).toStrictEqual(false);
  });
});

describe("indicatesMergeConflict", () => {
  const it = test
    .extend("conflictingMergeableIsConflict", () =>
      indicatesMergeConflict({ mergeable: "CONFLICTING" }))
    .extend("dirtyMergeStateIsConflict", () =>
      indicatesMergeConflict({ merge_state_status: "DIRTY" }),
    )
    .extend("bareNumberIsConflict", () => indicatesMergeConflict({ number: 7 }));

  it("mergeable が CONFLICTING ならコンフリクト", ({ conflictingMergeableIsConflict }) => {
    expect(conflictingMergeableIsConflict).toStrictEqual(true);
  });

  it("merge_state_status が DIRTY ならコンフリクト", ({ dirtyMergeStateIsConflict }) => {
    expect(dirtyMergeStateIsConflict).toStrictEqual(true);
  });

  it("両フィールドとも無ければコンフリクトではない", ({ bareNumberIsConflict }) => {
    expect(bareNumberIsConflict).toStrictEqual(false);
  });
});

describe("indicatesBehindBase", () => {
  const it = test
    .extend("behindMergeStateIsBehindBase", () =>
      indicatesBehindBase({ merge_state_status: "BEHIND" }))
    .extend("cleanMergeStateIsBehindBase", () =>
      indicatesBehindBase({ merge_state_status: "CLEAN" }),
    );

  it("merge_state_status が BEHIND なら base 遅れ", ({ behindMergeStateIsBehindBase }) => {
    expect(behindMergeStateIsBehindBase).toStrictEqual(true);
  });

  it("BEHIND 以外は base 遅れではない", ({ cleanMergeStateIsBehindBase }) => {
    expect(cleanMergeStateIsBehindBase).toStrictEqual(false);
  });
});
