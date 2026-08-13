import { describe, expect, test } from "vite-plus/test";

import { baseUpdateCheckDeliveryId, startupDrainDeliveryId, synthesizeEnvelope } from "./synth.ts";

describe("synthesizeEnvelope", () => {
  const it = test
    .extend("envelopeWithAuthorLogin", () =>
      synthesizeEnvelope({
        filtered: { kind: "base-update", pullNumber: 7 },
        deliveryId: "check-base-updates:7:base-sha:head-sha",
        authorLogin: "octocat",
      }))
    .extend("envelopeWithoutAuthorLogin", () =>
      synthesizeEnvelope({
        filtered: { kind: "base-update", pullNumber: 7 },
        deliveryId: "delivery-1",
        authorLogin: null,
      }),
    )
    .extend("checkSuiteEnvelope", () =>
      synthesizeEnvelope({
        filtered: {
          kind: "ci-completed",
          pullNumber: 7,
          conclusion: "failure",
          headSha: "head-sha",
        },
        deliveryId: "delivery-1",
        authorLogin: "octocat",
      }),
    );

  it("合成ペイロードにはルーティング用の作者 login がマージされる", ({
    envelopeWithAuthorLogin,
  }) => {
    expect(envelopeWithAuthorLogin).toStrictEqual({
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

  it("作者アカウントが削除済みなら user を付けない", ({ envelopeWithoutAuthorLogin }) => {
    expect(envelopeWithoutAuthorLogin).toStrictEqual({
      schema_version: 1,
      event_type: "pull_request",
      delivery_id: "delivery-1",
      payload: {
        action: "synchronize",
        pull_request: { number: 7, mergeable: "MERGEABLE", merge_state_status: "BEHIND" },
      },
    });
  });

  it("pull_request を本来持たない check_suite にはルーティング専用に付加される", ({
    checkSuiteEnvelope,
  }) => {
    expect(checkSuiteEnvelope).toStrictEqual({
      schema_version: 1,
      event_type: "check_suite",
      delivery_id: "delivery-1",
      payload: {
        action: "completed",
        check_suite: {
          conclusion: "failure",
          head_sha: "head-sha",
          pull_requests: [{ number: 7 }],
        },
        pull_request: { user: { login: "octocat" } },
      },
    });
  });
});

describe("決定的な delivery ID", () => {
  const it = test
    .extend("startupDrainId", () =>
      startupDrainDeliveryId({ eventType: "check_suite", detail: "7:head-sha:failure" }))
    .extend("baseUpdateCheckId", () =>
      baseUpdateCheckDeliveryId({
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
      }),
    );

  it("startup drain の ID は種別とキーから組み立てられる", ({ startupDrainId }) => {
    expect(startupDrainId).toStrictEqual("startup-drain:check_suite:7:head-sha:failure");
  });

  it("base-update checker の ID は base と head の SHA を含む", ({ baseUpdateCheckId }) => {
    expect(baseUpdateCheckId).toStrictEqual("check-base-updates:7:base-sha:head-sha");
  });
});
