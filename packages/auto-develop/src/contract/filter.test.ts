import { describe, expect, test } from "vite-plus/test";

import { filterEvent } from "./filter.ts";

describe("種別ディスパッチ", () => {
  test("pull_request 族は pull_request フィルタへ届く", () => {
    const event = { event_type: "pull_request", action: "closed", pull_request: { number: 7 } };
    expect(filterEvent(event, "reviewer")).toStrictEqual({ kind: "pr-closed", pullNumber: 7 });
  });

  test("pull_request_review 族は review フィルタへ届く", () => {
    const event = {
      event_type: "pull_request_review",
      action: "submitted",
      pull_request: { number: 7 },
      review: { state: "changes_requested", body: null },
    };
    expect(filterEvent(event, "author")).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "",
    });
  });

  test("check_suite 族は check_suite フィルタへ届く", () => {
    const event = {
      event_type: "check_suite",
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "0a1b2c3", pull_requests: [{ number: 7 }] },
    };
    expect(filterEvent(event, "author")).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
    });
  });

  test("event_type が無ければ type キーへフォールバックする", () => {
    const event = { type: "pull_request", action: "closed", pull_request: { number: 7 } };
    expect(filterEvent(event, "reviewer")).toStrictEqual({ kind: "pr-closed", pullNumber: 7 });
  });

  test("未知の種別は不採用になる", () => {
    expect(filterEvent({ event_type: "push", ref: "refs/heads/main" }, "reviewer")).toStrictEqual(
      null,
    );
  });

  test("event_type も type も無ければ不採用になる", () => {
    expect(filterEvent({ action: "closed" }, "reviewer")).toStrictEqual(null);
  });
});
