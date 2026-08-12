import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { runConnectionCycle } from "./connection-cycle.ts";
import { createRestartRequest } from "./restart-request.ts";

import type { JobQueue } from "../queue/job-queue.ts";
import type { EventDispatcher } from "./event-dispatch.ts";

const reviewRequestedRaw = (deliveryId: string): Readonly<Record<string, unknown>> => ({
  event_type: "pull_request",
  delivery_id: deliveryId,
  action: "review_requested",
  number: 7,
  pull_request: { number: 7, draft: false, title: "title" },
  requested_reviewer: { login: "review-bot" },
});

const idleQueue = (drain: () => Promise<void>): JobQueue => ({
  enqueue: () => true,
  enqueueFollowUp: () => true,
  setHandlers: () => undefined,
  runningLanes: () => [],
  waitingLanes: () => [],
  size: () => ({ waiting: 0, running: 0 }),
  isIdle: () => true,
  admitsLane: () => true,
  cancelLane: () => 0,
  drain,
  reserveLane: () => Promise.resolve(null),
});

const runCycle = async (setup: {
  readonly drained?: readonly Readonly<Record<string, unknown>>[];
  readonly streamed?: readonly Readonly<Record<string, unknown>>[];
  readonly signalAfter?: number;
  readonly restartAfter?: number;
  readonly restartAfterStream?: boolean;
}) => {
  const dispatched = vi.fn<EventDispatcher["dispatch"]>(() => true);
  const drainCalls = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const syncMain = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const restart = createRestartRequest({ onRequest: () => undefined });
  const onActivity = vi.fn<() => void>();
  const seen = new Map([["count", 0]]);
  const cycleEnding = await runConnectionCycle({
    mode: "reviewer",
    syncMain,
    startupDrain: () => Promise.resolve(setup.drained ?? []),
    subscribe: async function* subscribe() {
      await Promise.resolve();
      for (const raw of setup.streamed ?? []) {
        yield raw;
        seen.set("count", (seen.get("count") ?? 0) + 1);
        if (setup.restartAfter === seen.get("count")) restart.request("code-updated");
      }
      if (setup.restartAfterStream === true) restart.request("idle");
    },
    dispatcher: { dispatch: dispatched },
    queue: idleQueue(drainCalls),
    restart,
    onActivity,
    signalled: () =>
      setup.signalAfter !== undefined && (seen.get("count") ?? 0) >= setup.signalAfter,
    log: silentLogger,
  });
  return {
    outcome: cycleEnding,
    dispatchCount: dispatched.mock.calls.length,
    drains: drainCalls.mock.calls.length,
    syncs: syncMain.mock.calls.length,
    activityRecords: onActivity.mock.calls.length,
  };
};

const it = test
  .extend("emptyCycle", () => runCycle({}))
  .extend("drainedCycle", () => runCycle({ drained: [reviewRequestedRaw("d-1")] }))
  .extend("streamedCycle", () =>
    runCycle({ streamed: [reviewRequestedRaw("d-2"), reviewRequestedRaw("d-3")] }),
  )
  .extend("signalledCycle", () =>
    runCycle({ streamed: [reviewRequestedRaw("d-4"), reviewRequestedRaw("d-5")], signalAfter: 1 }),
  )
  .extend("restartedCycle", () =>
    runCycle({ streamed: [reviewRequestedRaw("d-6"), reviewRequestedRaw("d-7")], restartAfter: 1 }),
  )
  .extend("unknownEventCycle", () => runCycle({ streamed: [{ event_type: "ping" }] }))
  .extend("mixedDrainCycle", () =>
    runCycle({ drained: [reviewRequestedRaw("d-9"), { event_type: "ping" }] }),
  )
  .extend("signalledAfterStreamCycle", () => runCycle({ signalAfter: 0 }))
  .extend("restartedAfterStreamCycle", () =>
    runCycle({ streamed: [reviewRequestedRaw("d-8")], restartAfterStream: true }),
  );

describe("runConnectionCycle の通常経路", () => {
  it("サイクル開始時に main へ同期する", ({ emptyCycle }) => {
    expect(emptyCycle.syncs).toStrictEqual(1);
  });

  it("ストリームが尽きたら stream-ended を返す", ({ emptyCycle }) => {
    expect(emptyCycle.outcome).toStrictEqual("stream-ended");
  });

  it("ストリーム終了ではキューを排出してから戻る", ({ emptyCycle }) => {
    expect(emptyCycle.drains).toStrictEqual(1);
  });

  it("巻き取ったイベントを投入する", ({ drainedCycle }) => {
    expect(drainedCycle.dispatchCount).toStrictEqual(1);
  });

  it("購読したイベント 1 件ごとに活動を記録する", ({ streamedCycle }) => {
    expect(streamedCycle.activityRecords).toStrictEqual(2);
  });

  it("購読したイベントを順に投入する", ({ streamedCycle }) => {
    expect(streamedCycle.dispatchCount).toStrictEqual(2);
  });

  it("種別が合わないイベントは投入しない", ({ unknownEventCycle }) => {
    expect(unknownEventCycle.dispatchCount).toStrictEqual(0);
  });

  it("巻き取りに種別外が混ざっても選別を通った分だけ投入する", ({ mixedDrainCycle }) => {
    expect(mixedDrainCycle.dispatchCount).toStrictEqual(1);
  });
});

describe("runConnectionCycle の中断", () => {
  it("シグナルを受けたら signalled を返す", ({ signalledCycle }) => {
    expect(signalledCycle.outcome).toStrictEqual("signalled");
  });

  it("シグナル終了ではキューを排出しない", ({ signalledCycle }) => {
    expect(signalledCycle.drains).toStrictEqual(0);
  });

  it("再起動要求を受けたら restart-requested を返す", ({ restartedCycle }) => {
    expect(restartedCycle.outcome).toStrictEqual("restart-requested");
  });

  it("再起動要求でもキューを排出しない", ({ restartedCycle }) => {
    expect(restartedCycle.drains).toStrictEqual(0);
  });

  it("ストリーム終了直後のシグナルも signalled として拾う", ({ signalledAfterStreamCycle }) => {
    expect(signalledAfterStreamCycle.outcome).toStrictEqual("signalled");
  });

  it("ストリーム終了直後の再起動要求も restart-requested として拾う", ({
    restartedAfterStreamCycle,
  }) => {
    expect(restartedAfterStreamCycle.outcome).toStrictEqual("restart-requested");
  });
});
