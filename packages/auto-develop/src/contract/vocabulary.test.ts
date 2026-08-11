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
  test("author はモードとして認められる", () => {
    expect(isMode("author")).toStrictEqual(true);
  });

  test("語彙外の文字列はモードではない", () => {
    expect(isMode("observer")).toStrictEqual(false);
  });
});

describe("isReviewState", () => {
  test("changes_requested はレビュー判定語彙に含まれる", () => {
    expect(isReviewState("changes_requested")).toStrictEqual(true);
  });

  test("dismissed は語彙外になる", () => {
    expect(isReviewState("dismissed")).toStrictEqual(false);
  });
});

describe("isAuthorWorkReviewState", () => {
  test("changes_requested だけが著者作業を起動する", () => {
    expect(isAuthorWorkReviewState("changes_requested")).toStrictEqual(true);
  });

  test("approved は著者作業を起動しない", () => {
    expect(isAuthorWorkReviewState("approved")).toStrictEqual(false);
  });
});

describe("isCheckSuiteConclusion", () => {
  test("startup_failure は check suite 特有の結論として認められる", () => {
    expect(isCheckSuiteConclusion("startup_failure")).toStrictEqual(true);
  });

  test("null は語彙外になる", () => {
    expect(isCheckSuiteConclusion(null)).toStrictEqual(false);
  });
});

describe("isAuthorWorkConclusion", () => {
  test("timed_out は著者作業を起動する", () => {
    expect(isAuthorWorkConclusion("timed_out")).toStrictEqual(true);
  });

  test("success は著者作業を起動しない", () => {
    expect(isAuthorWorkConclusion("success")).toStrictEqual(false);
  });
});

describe("indicatesMergeConflict", () => {
  test("mergeable が CONFLICTING ならコンフリクト", () => {
    expect(indicatesMergeConflict({ mergeable: "CONFLICTING" })).toStrictEqual(true);
  });

  test("merge_state_status が DIRTY ならコンフリクト", () => {
    expect(indicatesMergeConflict({ merge_state_status: "DIRTY" })).toStrictEqual(true);
  });

  test("両フィールドとも無ければコンフリクトではない", () => {
    expect(indicatesMergeConflict({ number: 7 })).toStrictEqual(false);
  });
});

describe("indicatesBehindBase", () => {
  test("merge_state_status が BEHIND なら base 遅れ", () => {
    expect(indicatesBehindBase({ merge_state_status: "BEHIND" })).toStrictEqual(true);
  });

  test("BEHIND 以外は base 遅れではない", () => {
    expect(indicatesBehindBase({ merge_state_status: "CLEAN" })).toStrictEqual(false);
  });
});
