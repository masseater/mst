import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { silentLogger } from "../logging/logger.ts";
import { createReviewInputCoordinator } from "./review-input-coordinator.ts";

import type { JobQueue } from "../queue/job-queue.ts";

const queueStub = (behaviour: {
  readonly admits: boolean;
  readonly runningLanes: readonly string[];
  readonly acceptsFollowUp: boolean;
}): JobQueue => ({
  enqueue: () => true,
  enqueueFollowUp: () => behaviour.acceptsFollowUp,
  setHandlers: () => undefined,
  runningLanes: () => behaviour.runningLanes,
  waitingLanes: () => [],
  size: () => ({ waiting: 0, running: behaviour.runningLanes.length }),
  isIdle: () => behaviour.runningLanes.length === 0,
  admitsLane: () => behaviour.admits,
  cancelLane: () => 0,
  drain: () => Promise.resolve(),
  reserveLane: () => Promise.resolve(null),
});

const runCoordinator = async (setup: {
  readonly closed?: boolean;
  readonly admits?: boolean;
  readonly running?: boolean;
  readonly acceptsFollowUp?: boolean;
}) => {
  const gate = createLifecycleGate();
  if (setup.closed === true) gate.close(7);
  const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
  const enqueueFollowUp = vi.fn<JobQueue["enqueueFollowUp"]>(() => setup.acceptsFollowUp ?? true);
  const queue: JobQueue = {
    ...queueStub({
      admits: setup.admits ?? true,
      runningLanes: setup.running === true ? ["pr-7"] : [],
      acceptsFollowUp: setup.acceptsFollowUp ?? true,
    }),
    enqueueFollowUp,
  };
  const coordinate = createReviewInputCoordinator({
    gate,
    queue,
    stopSession,
    jobType: "review-input-changed",
    log: silentLogger,
  });
  const accepted = await coordinate({ prNumber: 7, endpoint: "head" });
  return {
    accepted,
    enqueued: enqueueFollowUp.mock.calls,
    stops: stopSession.mock.calls.length,
    generation: gate.generationOf(7),
  };
};

const it = test
  .extend("idleRun", () => runCoordinator({}))
  .extend("closedRun", () => runCoordinator({ closed: true }))
  .extend("filteredRun", () => runCoordinator({ admits: false }))
  .extend("runningRun", () => runCoordinator({ running: true }))
  .extend("refusedRun", () => runCoordinator({ acceptsFollowUp: false }));

describe("createReviewInputCoordinator", () => {
  it("アイドル中の PR は後続ジョブを積んで受理する", ({ idleRun }) => {
    expect(idleRun.accepted).toStrictEqual(true);
  });

  it("アイドル中は世代を進めない", ({ idleRun }) => {
    expect(idleRun.generation).toStrictEqual(0);
  });

  it("アイドル中はセッション停止を呼ばない", ({ idleRun }) => {
    expect(idleRun.stops).toStrictEqual(0);
  });

  it("クローズ済み PR のイベントは破棄する", ({ closedRun }) => {
    expect(closedRun.accepted).toStrictEqual(false);
  });

  it("クローズ済み PR では後続ジョブを積まない", ({ closedRun }) => {
    expect(closedRun.enqueued).toStrictEqual([]);
  });

  it("レーンフィルタに落ちるイベントは破棄する", ({ filteredRun }) => {
    expect(filteredRun.accepted).toStrictEqual(false);
  });

  it("実行中の PR は世代を 1 つ進める", ({ runningRun }) => {
    expect(runningRun.generation).toStrictEqual(1);
  });

  it("実行中の PR はセッション停止を 1 回呼ぶ", ({ runningRun }) => {
    expect(runningRun.stops).toStrictEqual(1);
  });

  it("キューが後続を拒めば受理しない", ({ refusedRun }) => {
    expect(refusedRun.accepted).toStrictEqual(false);
  });
});
