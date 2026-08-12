import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import {
  createAuthorHandler,
  type AuthorHandlerConfig,
  type AuthorReason,
} from "./author-handler.ts";

import type { HandlerGithubClient, PrSnapshot } from "./github-client.ts";

const snapshot = (overrides: Partial<PrSnapshot> = {}): PrSnapshot => ({
  prNumber: 7,
  title: "title",
  body: "body",
  state: "OPEN",
  headRefName: "topic/x",
  headRefOid: "sha-1",
  baseRefName: "main",
  draft: false,
  requestedReviewerLogins: [],
  ...overrides,
});

const failureMessageOf = (failure: unknown): string | null =>
  failure instanceof Error ? failure.message : null;

const runHandler = async (setup: {
  readonly snapshots: readonly PrSnapshot[];
  readonly reason?: AuthorReason;
  readonly sessionFailure?: Error;
  readonly rerequestFailure?: Error;
  readonly dryRun?: boolean;
}) => {
  const statuses = new Map<number, { readonly sha: string; readonly state: string }>();
  const snapshotIndex = new Map([["next", 0]]);
  const github: HandlerGithubClient = {
    prSnapshot: () => {
      const index = snapshotIndex.get("next") ?? 0;
      snapshotIndex.set("next", index + 1);
      return Promise.resolve(
        setup.snapshots[Math.min(index, setup.snapshots.length - 1)] as PrSnapshot,
      );
    },
    createCommitStatus: (request) => {
      statuses.set(statuses.size, { sha: request.sha, state: request.state });
      return Promise.resolve();
    },
    listReviews: () => Promise.resolve([]),
    requestReviewers: () =>
      setup.rerequestFailure === undefined
        ? Promise.resolve()
        : Promise.reject(setup.rerequestFailure),
  };
  const requestReviewers = vi.fn<HandlerGithubClient["requestReviewers"]>(github.requestReviewers);
  const runSession = vi.fn<AuthorHandlerConfig["runSession"]>(() =>
    setup.sessionFailure === undefined ? Promise.resolve() : Promise.reject(setup.sessionFailure),
  );
  const handler = createAuthorHandler({
    github: { ...github, requestReviewers },
    runSession,
    reviewerLogin: "review-bot",
    dryRun: setup.dryRun ?? false,
    log: silentLogger,
  });
  try {
    await handler({ prNumber: 7, reason: setup.reason ?? "request_changes" });
    return {
      statuses: [...statuses.values()],
      rerequests: requestReviewers.mock.calls,
      sessionArgs: runSession.mock.calls,
      failure: null,
      failureMessage: null,
    };
  } catch (handlerFailure) {
    return {
      statuses: [...statuses.values()],
      rerequests: requestReviewers.mock.calls,
      sessionArgs: runSession.mock.calls,
      failure: handlerFailure,
      failureMessage: failureMessageOf(handlerFailure),
    };
  }
};

const it = test
  .extend("cleanRun", () => runHandler({ snapshots: [snapshot(), snapshot()] }))
  .extend("headAdvancedRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot({ headRefOid: "sha-2" })] }),
  )
  .extend("ciFailureRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot()], reason: "ci_failure" }),
  )
  .extend("dryRun", () => runHandler({ snapshots: [snapshot()], dryRun: true }))
  .extend("sessionFailedRun", () =>
    runHandler({
      snapshots: [snapshot(), snapshot({ headRefOid: "sha-2" })],
      sessionFailure: new Error("engine broke"),
    }),
  )
  .extend("rerequestFailedRun", () =>
    runHandler({
      snapshots: [snapshot(), snapshot({ headRefOid: "sha-2" })],
      rerequestFailure: new Error("GitHub refused"),
    }),
  );

describe("createAuthorHandler の正常系", () => {
  it("正常完了は pending と success の 2 つのステータスを残す", ({ cleanRun }) => {
    expect(cleanRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-1", state: "success" },
    ]);
  });

  it("正常完了はレビュー担当へ 1 回だけ再依頼する", ({ cleanRun }) => {
    expect(cleanRun.rerequests).toStrictEqual([[{ prNumber: 7, logins: ["review-bot"] }]]);
  });

  it("実行中に head が進めば success は実行後の head に付く", ({ headAdvancedRun }) => {
    expect(headAdvancedRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-2", state: "success" },
    ]);
  });

  it("pending は実行前の head に付く", ({ headAdvancedRun }) => {
    expect(headAdvancedRun.statuses[0]).toStrictEqual({ sha: "sha-1", state: "pending" });
  });

  it("イベント種別は理由としてセッションへ渡る", ({ ciFailureRun }) => {
    expect(ciFailureRun.sessionArgs).toStrictEqual([
      [{ prNumber: 7, headBranch: "topic/x", reason: "ci_failure" }],
    ]);
  });
});

describe("createAuthorHandler の dry run", () => {
  it("dry run はステータスを書かない", ({ dryRun }) => {
    expect(dryRun.statuses).toStrictEqual([]);
  });

  it("dry run は再依頼もしない", ({ dryRun }) => {
    expect(dryRun.rerequests).toStrictEqual([]);
  });
});

describe("createAuthorHandler の失敗", () => {
  it("セッション失敗は実行後 head へ failure を書く", ({ sessionFailedRun }) => {
    expect(sessionFailedRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-2", state: "failure" },
    ]);
  });

  it("セッション失敗では再依頼しない", ({ sessionFailedRun }) => {
    expect(sessionFailedRun.rerequests).toStrictEqual([]);
  });

  it("セッション失敗の例外は伝播する", ({ sessionFailedRun }) => {
    expect(sessionFailedRun.failureMessage).toStrictEqual("engine broke");
  });

  it("再依頼失敗は pending → success → failure の 3 つを残す", ({ rerequestFailedRun }) => {
    expect(rerequestFailedRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-2", state: "success" },
      { sha: "sha-2", state: "failure" },
    ]);
  });

  it("再依頼失敗の例外は伝播する", ({ rerequestFailedRun }) => {
    expect(rerequestFailedRun.failureMessage).toStrictEqual("GitHub refused");
  });
});
