import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { ReviewInputChangedError } from "../lifecycle/review-input-changed-error.ts";
import { silentLogger } from "../logging/logger.ts";
import { createReviewerHandler, type ReviewerHandlerConfig } from "./reviewer-handler.ts";

import type { Review } from "../lifecycle/review-verdict.ts";
import type { HandlerGithubClient, PrSnapshot } from "./github-client.ts";

type RunOutcome = {
  readonly statuses: readonly { readonly sha: string; readonly state: string }[];
  readonly followUps: readonly unknown[][];
  readonly sessionCalls: number;
  readonly failure: unknown;
  readonly failureMessage: string | null;
};

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
  readonly reviews?: readonly Review[];
  readonly sessionFailure?: Error;
  readonly dryRun?: boolean;
  readonly proxyLogin?: string | null;
  readonly staleGeneration?: boolean;
  readonly staleAfterSession?: boolean;
}): Promise<RunOutcome> => {
  const statuses = new Map<number, { readonly sha: string; readonly state: string }>();
  const snapshotIndex = new Map([["next", 0]]);
  const gate = createLifecycleGate();
  const github: HandlerGithubClient = {
    prSnapshot: () => {
      const index = snapshotIndex.get("next") ?? 0;
      snapshotIndex.set("next", index + 1);
      if (setup.staleGeneration === true && index === 0) gate.interruptForInputChange(7);
      if (setup.staleAfterSession === true && index === 1) gate.interruptForInputChange(7);
      return Promise.resolve(
        setup.snapshots[Math.min(index, setup.snapshots.length - 1)] as PrSnapshot,
      );
    },
    createCommitStatus: (request) => {
      statuses.set(statuses.size, { sha: request.sha, state: request.state });
      return Promise.resolve();
    },
    listReviews: () => Promise.resolve(setup.reviews ?? []),
    requestReviewers: () => Promise.resolve(),
  };
  const requestFollowUpReview = vi.fn<ReviewerHandlerConfig["requestFollowUpReview"]>();
  const runSession = vi.fn<ReviewerHandlerConfig["runSession"]>(() =>
    setup.sessionFailure === undefined ? Promise.resolve() : Promise.reject(setup.sessionFailure),
  );
  const handler = createReviewerHandler({
    github,
    gate,
    runSession,
    requestFollowUpReview,
    dryRun: setup.dryRun ?? false,
    ...(setup.proxyLogin === null ? {} : { proxyLogin: setup.proxyLogin ?? "review-bot" }),
    log: silentLogger,
  });
  try {
    await handler(7);
    return {
      statuses: [...statuses.values()],
      followUps: requestFollowUpReview.mock.calls,
      sessionCalls: runSession.mock.calls.length,
      failure: null,
      failureMessage: null,
    };
  } catch (handlerFailure) {
    return {
      statuses: [...statuses.values()],
      followUps: requestFollowUpReview.mock.calls,
      sessionCalls: runSession.mock.calls.length,
      failure: handlerFailure,
      failureMessage: failureMessageOf(handlerFailure),
    };
  }
};

const review = (overrides: Partial<Review>): Review => ({
  state: "APPROVED",
  body: "",
  submittedAt: "2026-08-11T00:00:00.000Z",
  commitSha: "sha-1",
  authorLogin: "review-bot",
  ...overrides,
});

const it = test
  .extend("cleanRun", () => runHandler({ snapshots: [snapshot(), snapshot()] }))
  .extend("changesRequestedRun", () =>
    runHandler({
      snapshots: [snapshot(), snapshot()],
      reviews: [review({ state: "CHANGES_REQUESTED" })],
    }),
  )
  .extend("noEffectiveReviewRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot()], reviews: [] }),
  )
  .extend("dryRun", () => runHandler({ snapshots: [snapshot()], dryRun: true }))
  .extend("missingProxyLoginRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot()], proxyLogin: null }),
  )
  .extend("baseChangedRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot({ baseRefName: "develop" })] }),
  )
  .extend("headChangedRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot({ headRefOid: "sha-2" })] }),
  )
  .extend("staleBeforeStartRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot()], staleGeneration: true }),
  )
  .extend("sessionFailedRun", () =>
    runHandler({ snapshots: [snapshot(), snapshot()], sessionFailure: new Error("engine broke") }),
  )
  .extend("interruptedRun", () =>
    runHandler({
      snapshots: [snapshot(), snapshot()],
      sessionFailure: new ReviewInputChangedError(7),
    }),
  )
  .extend("failedAndBaseChangedRun", () =>
    runHandler({
      snapshots: [snapshot(), snapshot({ baseRefName: "develop" })],
      sessionFailure: new Error("engine broke"),
    }),
  )
  .extend("failedAfterGenerationMovedRun", () =>
    runHandler({
      snapshots: [snapshot(), snapshot()],
      sessionFailure: new Error("engine broke"),
      staleAfterSession: true,
    }),
  );

describe("createReviewerHandler の正常系", () => {
  it("正常完了は pending と success の 2 つのステータスを残す", ({ cleanRun }) => {
    expect(cleanRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-1", state: "success" },
    ]);
  });

  it("変更要求のレビューがあれば最終ステータスは error になる", ({ changesRequestedRun }) => {
    expect(changesRequestedRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-1", state: "error" },
    ]);
  });

  it("実効レビューが無くても最終ステータスは success になる", ({ noEffectiveReviewRun }) => {
    expect(noEffectiveReviewRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-1", state: "success" },
    ]);
  });

  it("代理ログイン未設定なら判定を取りに行かず failure を書く", ({ missingProxyLoginRun }) => {
    expect(missingProxyLoginRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-1", state: "failure" },
    ]);
  });
});

describe("createReviewerHandler の dry run", () => {
  it("dry run はステータスを 1 つも書かない", ({ dryRun }) => {
    expect(dryRun.statuses).toStrictEqual([]);
  });

  it("dry run はセッションを起動しない", ({ dryRun }) => {
    expect(dryRun.sessionCalls).toStrictEqual(0);
  });
});

describe("createReviewerHandler の入力変更", () => {
  it("base が変われば後続レビューを base 側で 1 回要求する", ({ baseChangedRun }) => {
    expect(baseChangedRun.followUps).toStrictEqual([[{ prNumber: 7, endpoint: "base" }]]);
  });

  it("base が変われば最終ステータスを書かない", ({ baseChangedRun }) => {
    expect(baseChangedRun.statuses).toStrictEqual([{ sha: "sha-1", state: "pending" }]);
  });

  it("head が変われば後続レビューを head 側で 1 回要求する", ({ headChangedRun }) => {
    expect(headChangedRun.followUps).toStrictEqual([[{ prNumber: 7, endpoint: "head" }]]);
  });

  it("スナップショット取得中に世代が変わればステータスを 1 つも書かない", ({
    staleBeforeStartRun,
  }) => {
    expect(staleBeforeStartRun.statuses).toStrictEqual([]);
  });

  it("スナップショット取得中に世代が変わればエンジンを起動しない", ({ staleBeforeStartRun }) => {
    expect(staleBeforeStartRun.sessionCalls).toStrictEqual(0);
  });
});

describe("createReviewerHandler の失敗", () => {
  it("セッション失敗は failure ステータスを残す", ({ sessionFailedRun }) => {
    expect(sessionFailedRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
      { sha: "sha-1", state: "failure" },
    ]);
  });

  it("セッション失敗の例外はそのまま伝播する", ({ sessionFailedRun }) => {
    expect(sessionFailedRun.failureMessage).toStrictEqual("engine broke");
  });

  it("入力変更による中断は静かに終わりステータスを増やさない", ({ interruptedRun }) => {
    expect(interruptedRun.statuses).toStrictEqual([{ sha: "sha-1", state: "pending" }]);
  });

  it("入力変更による中断は後続要求もしない", ({ interruptedRun }) => {
    expect(interruptedRun.followUps).toStrictEqual([]);
  });

  it("失敗の直後に世代が進んでいたら failure を書かない", ({ failedAfterGenerationMovedRun }) => {
    expect(failedAfterGenerationMovedRun.statuses).toStrictEqual([
      { sha: "sha-1", state: "pending" },
    ]);
  });

  it("失敗の直後に世代が進んでいたら例外も伝播しない", ({ failedAfterGenerationMovedRun }) => {
    expect(failedAfterGenerationMovedRun.failure).toStrictEqual(null);
  });

  it("失敗しつつ base も変わっていたら後続要求だけを行う", ({ failedAndBaseChangedRun }) => {
    expect(failedAndBaseChangedRun.followUps).toStrictEqual([[{ prNumber: 7, endpoint: "base" }]]);
  });

  it("失敗しつつ base も変わっていたら例外を伝播しない", ({ failedAndBaseChangedRun }) => {
    expect(failedAndBaseChangedRun.failure).toStrictEqual(null);
  });
});
