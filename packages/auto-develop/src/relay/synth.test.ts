import { describe, expect, test } from "vite-plus/test";

import { baseUpdateCheckDeliveryId, startupDrainDeliveryId, synthesizeEnvelope } from "./synth.ts";

import type { GithubPullSummary } from "./github-reader.ts";

const behindPull: GithubPullSummary = {
  number: 7,
  title: "Add retry",
  draft: false,
  authorLogin: "octocat",
  baseSha: "base-sha",
  headSha: "head-sha",
  mergeable: "MERGEABLE",
  mergeStateStatus: "BEHIND",
  reviewDecision: null,
  labelNames: [],
  requestedReviewerLogins: [],
};

describe("synthesizeEnvelope", () => {
  test("合成ペイロードにはルーティング用の作者 login がマージされる", () => {
    const envelope = synthesizeEnvelope({
      filtered: { kind: "base-update", pullNumber: 7 },
      deliveryId: "check-base-updates:7:base-sha:head-sha",
      authorLogin: "octocat",
    });
    expect(envelope).toStrictEqual({
      schema_version: 1,
      event_type: "pull_request",
      delivery_id: "check-base-updates:7:base-sha:head-sha",
      payload: {
        action: "synchronize",
        pull_request: {
          number: 7,
          mergeable: "MERGEABLE",
          merge_state_status: "BEHIND",
          user: { login: "octocat" },
        },
      },
    });
  });

  test("作者アカウントが削除済みなら user を付けない", () => {
    const envelope = synthesizeEnvelope({
      filtered: { kind: "base-update", pullNumber: 7 },
      deliveryId: "delivery-1",
      authorLogin: null,
    });
    expect(envelope.payload).toStrictEqual({
      action: "synchronize",
      pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
    });
  });

  test("pull_request を本来持たない check_suite にはルーティング専用に付加される", () => {
    const envelope = synthesizeEnvelope({
      filtered: { kind: "ci-completed", pullNumber: 7, conclusion: "failure", headSha: "head-sha" },
      deliveryId: "delivery-1",
      authorLogin: "octocat",
    });
    expect(envelope.payload).toStrictEqual({
      action: "completed",
      check_suite: { conclusion: "failure", head_sha: "head-sha", pull_requests: [{ number: 7 }] },
      pull_request: { user: { login: "octocat" } },
    });
  });
});

describe("決定的な delivery ID", () => {
  test("startup drain の ID は種別とキーから組み立てられる", () => {
    expect(
      startupDrainDeliveryId({ eventType: "check_suite", detail: "7:head-sha:failure" }),
    ).toStrictEqual("startup-drain:check_suite:7:head-sha:failure");
  });

  test("base-update checker の ID は base と head の SHA を含む", () => {
    expect(baseUpdateCheckDeliveryId(behindPull)).toStrictEqual(
      "check-base-updates:7:base-sha:head-sha",
    );
  });
});
