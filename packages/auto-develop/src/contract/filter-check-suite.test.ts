import { describe, expect, test } from "vite-plus/test";

import { filterCheckSuiteEvent } from "./filter-check-suite.ts";

const completedSuite = (conclusion: string) => ({
  action: "completed",
  check_suite: {
    conclusion,
    head_sha: "0a1b2c3",
    pull_requests: [{ number: 7 }],
  },
});

const it = test
  .extend("failureVerdict", () => filterCheckSuiteEvent(completedSuite("failure"), "author"))
  .extend("timedOutVerdict", () => filterCheckSuiteEvent(completedSuite("timed_out"), "author"))
  .extend("startupFailureVerdict", () =>
    filterCheckSuiteEvent(completedSuite("startup_failure"), "author"),
  )
  .extend("deliveryCarryingVerdict", () =>
    filterCheckSuiteEvent({ ...completedSuite("failure"), delivery_id: "delivery-1" }, "author"),
  )
  .extend("multiPullVerdict", () =>
    filterCheckSuiteEvent(
      {
        action: "completed",
        check_suite: {
          conclusion: "failure",
          head_sha: "0a1b2c3",
          pull_requests: [{ number: 7 }, { number: 8 }],
        },
      },
      "author",
    ),
  )
  .extend("successVerdict", () => filterCheckSuiteEvent(completedSuite("success"), "author"))
  .extend("cancelledVerdict", () => filterCheckSuiteEvent(completedSuite("cancelled"), "author"))
  .extend("reviewerModeVerdict", () => filterCheckSuiteEvent(completedSuite("failure"), "reviewer"))
  .extend("requestedActionVerdict", () =>
    filterCheckSuiteEvent({ ...completedSuite("failure"), action: "requested" }, "author"),
  )
  .extend("emptyPullsVerdict", () =>
    filterCheckSuiteEvent(
      {
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [] },
      },
      "author",
    ),
  )
  .extend("nonArrayPullsVerdict", () =>
    filterCheckSuiteEvent(
      {
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: "all" },
      },
      "author",
    ),
  )
  .extend("nullSuiteVerdict", () =>
    filterCheckSuiteEvent({ action: "completed", check_suite: null }, "author"),
  )
  .extend("unnumberedPullVerdict", () =>
    filterCheckSuiteEvent(
      {
        action: "completed",
        check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ id: 1 }] },
      },
      "author",
    ),
  )
  .extend("nullConclusionVerdict", () =>
    filterCheckSuiteEvent(
      {
        action: "completed",
        check_suite: { conclusion: null, head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
      },
      "author",
    ),
  )
  .extend("headShaLessVerdict", () =>
    filterCheckSuiteEvent(
      {
        action: "completed",
        check_suite: { conclusion: "failure", pull_requests: [{ number: 7 }] },
      },
      "author",
    ),
  );

describe("採用される結論", () => {
  it("failure は ci-completed になり結論と head SHA を保持する", ({ failureVerdict }) => {
    expect(failureVerdict).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
    });
  });

  it("timed_out は ci-completed になる", ({ timedOutVerdict }) => {
    expect(timedOutVerdict).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "timed_out",
      headSha: "0a1b2c3",
    });
  });

  it("startup_failure は ci-completed になる", ({ startupFailureVerdict }) => {
    expect(startupFailureVerdict).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "startup_failure",
      headSha: "0a1b2c3",
    });
  });

  it("delivery_id があれば引き継ぐ", ({ deliveryCarryingVerdict }) => {
    expect(deliveryCarryingVerdict).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
      deliveryId: "delivery-1",
    });
  });

  it("複数の PR があれば先頭の番号だけ採用する", ({ multiPullVerdict }) => {
    expect(multiPullVerdict).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
    });
  });
});

describe("不採用になる形", () => {
  it("success は自動応答を起こさない", ({ successVerdict }) => {
    expect(successVerdict).toStrictEqual(null);
  });

  it("cancelled は自動応答を起こさない", ({ cancelledVerdict }) => {
    expect(cancelledVerdict).toStrictEqual(null);
  });

  it("reviewer モードでは結論を問わず不採用になる", ({ reviewerModeVerdict }) => {
    expect(reviewerModeVerdict).toStrictEqual(null);
  });

  it("completed 以外の action は不採用になる", ({ requestedActionVerdict }) => {
    expect(requestedActionVerdict).toStrictEqual(null);
  });

  it("pull_requests が空配列なら不採用になる", ({ emptyPullsVerdict }) => {
    expect(emptyPullsVerdict).toStrictEqual(null);
  });

  it("pull_requests が配列でなければ不採用になる", ({ nonArrayPullsVerdict }) => {
    expect(nonArrayPullsVerdict).toStrictEqual(null);
  });

  it("check_suite が null なら不採用になる", ({ nullSuiteVerdict }) => {
    expect(nullSuiteVerdict).toStrictEqual(null);
  });

  it("先頭の PR に number が無ければ不採用になる", ({ unnumberedPullVerdict }) => {
    expect(unnumberedPullVerdict).toStrictEqual(null);
  });

  it("結論が null なら構造不適合として不採用になる", ({ nullConclusionVerdict }) => {
    expect(nullConclusionVerdict).toStrictEqual(null);
  });

  it("head_sha が欠けていれば不採用になる", ({ headShaLessVerdict }) => {
    expect(headShaLessVerdict).toStrictEqual(null);
  });
});
