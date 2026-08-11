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

describe("採用される結論", () => {
  test("failure は ci-completed になり結論と head SHA を保持する", () => {
    expect(filterCheckSuiteEvent(completedSuite("failure"), "author")).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
    });
  });

  test("timed_out は ci-completed になる", () => {
    expect(filterCheckSuiteEvent(completedSuite("timed_out"), "author")).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "timed_out",
      headSha: "0a1b2c3",
    });
  });

  test("startup_failure は ci-completed になる", () => {
    expect(filterCheckSuiteEvent(completedSuite("startup_failure"), "author")).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "startup_failure",
      headSha: "0a1b2c3",
    });
  });

  test("delivery_id があれば引き継ぐ", () => {
    const event = { ...completedSuite("failure"), delivery_id: "delivery-1" };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
      deliveryId: "delivery-1",
    });
  });

  test("複数の PR があれば先頭の番号だけ採用する", () => {
    const event = {
      action: "completed",
      check_suite: {
        conclusion: "failure",
        head_sha: "0a1b2c3",
        pull_requests: [{ number: 7 }, { number: 8 }],
      },
    };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
    });
  });
});

describe("不採用になる形", () => {
  test("success は自動応答を起こさない", () => {
    expect(filterCheckSuiteEvent(completedSuite("success"), "author")).toStrictEqual(null);
  });

  test("cancelled は自動応答を起こさない", () => {
    expect(filterCheckSuiteEvent(completedSuite("cancelled"), "author")).toStrictEqual(null);
  });

  test("reviewer モードでは結論を問わず不採用になる", () => {
    expect(filterCheckSuiteEvent(completedSuite("failure"), "reviewer")).toStrictEqual(null);
  });

  test("completed 以外の action は不採用になる", () => {
    const event = { ...completedSuite("failure"), action: "requested" };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual(null);
  });

  test("pull_requests が空配列なら不採用になる", () => {
    const event = {
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [] },
    };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual(null);
  });

  test("pull_requests が配列でなければ不採用になる", () => {
    const event = {
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: "all" },
    };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual(null);
  });

  test("check_suite が null なら不採用になる", () => {
    expect(
      filterCheckSuiteEvent({ action: "completed", check_suite: null }, "author"),
    ).toStrictEqual(null);
  });

  test("先頭の PR に number が無ければ不採用になる", () => {
    const event = {
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ id: 1 }] },
    };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual(null);
  });

  test("結論が null なら構造不適合として不採用になる", () => {
    const event = {
      action: "completed",
      check_suite: { conclusion: null, head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
    };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual(null);
  });

  test("head_sha が欠けていれば不採用になる", () => {
    const event = {
      action: "completed",
      check_suite: { conclusion: "failure", pull_requests: [{ number: 7 }] },
    };
    expect(filterCheckSuiteEvent(event, "author")).toStrictEqual(null);
  });
});
