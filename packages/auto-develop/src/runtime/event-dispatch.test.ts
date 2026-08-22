import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createEventDispatcher } from "./event-dispatch.ts";

import type { JobQueue } from "../queue/job-queue.ts";

describe("createEventDispatcher の投入", () => {
  const it = test
    .extend("reviewRequestedEnqueue", () => {
      const enqueue = vi.fn<JobQueue["enqueue"]>(() => true);
      createEventDispatcher({
        queue: {
          enqueue,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed: () => undefined,
        onExcluded: () => undefined,
        log: silentLogger,
      }).dispatch({ kind: "review-requested", pullNumber: 7, deliveryId: "d-1" });
      return enqueue;
    })
    .extend("baseUpdateEnqueue", () => {
      const enqueue = vi.fn<JobQueue["enqueue"]>(() => true);
      createEventDispatcher({
        queue: {
          enqueue,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed: () => undefined,
        onExcluded: () => undefined,
        log: silentLogger,
      }).dispatch({ kind: "base-update", pullNumber: 12, deliveryId: "d-2" });
      return enqueue;
    })
    .extend("mergeConflictEnqueue", () => {
      const enqueue = vi.fn<JobQueue["enqueue"]>(() => true);
      createEventDispatcher({
        queue: {
          enqueue,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed: () => undefined,
        onExcluded: () => undefined,
        log: silentLogger,
      }).dispatch({ kind: "merge-conflict", pullNumber: 7 });
      return enqueue;
    })
    .extend("refusedAcceptance", () =>
      createEventDispatcher({
        queue: {
          enqueue: () => false,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed: () => undefined,
        onExcluded: () => undefined,
        log: silentLogger,
      }).dispatch({ kind: "base-update", pullNumber: 7, deliveryId: "d-4" }),
    );

  it("PR イベントを PR レーンのジョブとして積む", ({ reviewRequestedEnqueue }) => {
    expect(reviewRequestedEnqueue).toHaveBeenCalledWith({
      type: "pr-dispatched",
      payload: { kind: "review-requested", pullNumber: 7, deliveryId: "d-1" },
      key: "d-1",
      lane: "pr-7",
      label: "review-requested for PR #7",
    });
  });

  it("配信 ID を重複排除キーに使う", ({ baseUpdateEnqueue }) => {
    expect(baseUpdateEnqueue).toHaveBeenCalledWith({
      type: "pr-dispatched",
      payload: { kind: "base-update", pullNumber: 12, deliveryId: "d-2" },
      key: "d-2",
      lane: "pr-12",
      label: "base-update for PR #12",
    });
  });

  it("配信 ID が無ければ種別と PR 番号からキーを作る", ({ mergeConflictEnqueue }) => {
    expect(mergeConflictEnqueue).toHaveBeenCalledWith({
      type: "pr-dispatched",
      payload: { kind: "merge-conflict", pullNumber: 7 },
      key: "merge-conflict-7",
      lane: "pr-7",
      label: "merge-conflict for PR #7",
    });
  });

  it("キューが拒めば受理しなかったことを返す", ({ refusedAcceptance }) => {
    expect(refusedAcceptance).toBe(false);
  });
});

describe("createEventDispatcher のライフサイクル通知", () => {
  const it = test
    .extend("closureNotice", () => {
      const onPrClosed = vi.fn<(pullNumber: number) => void>();
      createEventDispatcher({
        queue: {
          enqueue: () => true,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed,
        onExcluded: () => undefined,
        log: silentLogger,
      }).dispatch({ kind: "pr-closed", pullNumber: 7, deliveryId: "d-2" });
      return onPrClosed;
    })
    .extend("closedEnqueue", () => {
      const enqueue = vi.fn<JobQueue["enqueue"]>(() => true);
      createEventDispatcher({
        queue: {
          enqueue,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed: () => undefined,
        onExcluded: () => undefined,
        log: silentLogger,
      }).dispatch({ kind: "pr-closed", pullNumber: 7, deliveryId: "d-2" });
      return enqueue;
    })
    .extend("exclusionNotice", () => {
      const onExcluded = vi.fn<(pullNumber: number) => void>();
      createEventDispatcher({
        queue: {
          enqueue: () => true,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed: () => undefined,
        onExcluded,
        log: silentLogger,
      }).dispatch({ kind: "pr-excluded", pullNumber: 7, deliveryId: "d-3" });
      return onExcluded;
    })
    .extend("excludedEnqueue", () => {
      const enqueue = vi.fn<JobQueue["enqueue"]>(() => true);
      createEventDispatcher({
        queue: {
          enqueue,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        },
        onPrClosed: () => undefined,
        onExcluded: () => undefined,
        log: silentLogger,
      }).dispatch({ kind: "pr-excluded", pullNumber: 7, deliveryId: "d-3" });
      return enqueue;
    });

  it("クローズはキューに積まずライフサイクルへ通知する", ({ closureNotice }) => {
    expect(closureNotice).toHaveBeenCalledWith(7);
  });

  it("クローズはジョブを積まない", ({ closedEnqueue }) => {
    expect(closedEnqueue).not.toHaveBeenCalled();
  });

  it("除外はキューに積まず除外通知を出す", ({ exclusionNotice }) => {
    expect(exclusionNotice).toHaveBeenCalledWith(7);
  });

  it("除外はジョブを積まない", ({ excludedEnqueue }) => {
    expect(excludedEnqueue).not.toHaveBeenCalled();
  });
});
