import { describe, expect, test } from "vite-plus/test";

import { filterEvent } from "./filter.ts";

describe("種別ディスパッチ", () => {
  const it = test
    .extend("pullRequestDispatch", () =>
      filterEvent(
        { event_type: "pull_request", action: "closed", pull_request: { number: 7 } },
        "reviewer",
      ))
    .extend("reviewDispatch", () =>
      filterEvent(
        {
          event_type: "pull_request_review",
          action: "submitted",
          pull_request: { number: 7 },
          review: { state: "changes_requested", body: null },
        },
        "author",
      ),
    )
    .extend("checkSuiteDispatch", () =>
      filterEvent(
        {
          event_type: "check_suite",
          action: "completed",
          check_suite: {
            conclusion: "failure",
            head_sha: "0a1b2c3",
            pull_requests: [{ number: 7 }],
          },
        },
        "author",
      ),
    )
    .extend("typeKeyDispatch", () =>
      filterEvent(
        { type: "pull_request", action: "closed", pull_request: { number: 7 } },
        "reviewer",
      ),
    )
    .extend("unknownKindDispatch", () =>
      filterEvent({ event_type: "push", ref: "refs/heads/main" }, "reviewer"),
    )
    .extend("kindlessDispatch", () => filterEvent({ action: "closed" }, "reviewer"));

  it("pull_request 族は pull_request フィルタへ届く", ({ pullRequestDispatch }) => {
    expect(pullRequestDispatch).toStrictEqual({ kind: "pr-closed", pullNumber: 7 });
  });

  it("pull_request_review 族は review フィルタへ届く", ({ reviewDispatch }) => {
    expect(reviewDispatch).toStrictEqual({
      kind: "source-review-submitted",
      pullNumber: 7,
      state: "changes_requested",
      body: "",
    });
  });

  it("check_suite 族は check_suite フィルタへ届く", ({ checkSuiteDispatch }) => {
    expect(checkSuiteDispatch).toStrictEqual({
      kind: "ci-completed",
      pullNumber: 7,
      conclusion: "failure",
      headSha: "0a1b2c3",
    });
  });

  it("event_type が無ければ type キーへフォールバックする", ({ typeKeyDispatch }) => {
    expect(typeKeyDispatch).toStrictEqual({ kind: "pr-closed", pullNumber: 7 });
  });

  it("未知の種別は不採用になる", ({ unknownKindDispatch }) => {
    expect(unknownKindDispatch).toStrictEqual(null);
  });

  it("event_type も type も無ければ不採用になる", ({ kindlessDispatch }) => {
    expect(kindlessDispatch).toStrictEqual(null);
  });
});
