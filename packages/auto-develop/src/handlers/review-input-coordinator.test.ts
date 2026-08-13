import { describe, expect, test, vi } from "vite-plus/test";

import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { silentLogger } from "../logging/logger.ts";
import { createReviewInputCoordinator } from "./review-input-coordinator.ts";

import type { JobQueue } from "../queue/job-queue.ts";

describe("createReviewInputCoordinator", () => {
  describe("アイドル中の PR", () => {
    const it = test
      .extend("idleAcceptance", async () => {
        const gate = createLifecycleGate();
        const idleQueue: JobQueue = {
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
        };
        const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
        const coordinate = createReviewInputCoordinator({
          gate,
          queue: idleQueue,
          stopSession,
          jobType: "review-input-changed",
          log: silentLogger,
        });
        return coordinate({ prNumber: 7, endpoint: "head" });
      })
      .extend("idleGeneration", async () => {
        const gate = createLifecycleGate();
        const idleQueue: JobQueue = {
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
        };
        const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
        const coordinate = createReviewInputCoordinator({
          gate,
          queue: idleQueue,
          stopSession,
          jobType: "review-input-changed",
          log: silentLogger,
        });
        await coordinate({ prNumber: 7, endpoint: "head" });
        return gate.generationOf(7);
      })
      .extend("idleStopSession", async () => {
        const gate = createLifecycleGate();
        const idleQueue: JobQueue = {
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
        };
        const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
        const coordinate = createReviewInputCoordinator({
          gate,
          queue: idleQueue,
          stopSession,
          jobType: "review-input-changed",
          log: silentLogger,
        });
        await coordinate({ prNumber: 7, endpoint: "head" });
        return stopSession;
      });

    it("後続ジョブを積んで受理する", ({ idleAcceptance }) => {
      expect(idleAcceptance).toBe(true);
    });

    it("世代を進めない", ({ idleGeneration }) => {
      expect(idleGeneration).toBe(0);
    });

    it("セッション停止を呼ばない", ({ idleStopSession }) => {
      expect(idleStopSession).not.toHaveBeenCalled();
    });
  });

  describe("クローズ済みの PR", () => {
    const it = test
      .extend("closedAcceptance", async () => {
        const gate = createLifecycleGate();
        gate.close(7);
        const idleQueue: JobQueue = {
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
        };
        const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
        const coordinate = createReviewInputCoordinator({
          gate,
          queue: idleQueue,
          stopSession,
          jobType: "review-input-changed",
          log: silentLogger,
        });
        return coordinate({ prNumber: 7, endpoint: "head" });
      })
      .extend("closedEnqueueFollowUp", async () => {
        const gate = createLifecycleGate();
        gate.close(7);
        const enqueueFollowUp = vi.fn<JobQueue["enqueueFollowUp"]>(() => true);
        const idleQueue: JobQueue = {
          enqueue: () => true,
          enqueueFollowUp,
          setHandlers: () => undefined,
          runningLanes: () => [],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 0 }),
          isIdle: () => true,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        };
        const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
        const coordinate = createReviewInputCoordinator({
          gate,
          queue: idleQueue,
          stopSession,
          jobType: "review-input-changed",
          log: silentLogger,
        });
        await coordinate({ prNumber: 7, endpoint: "head" });
        return enqueueFollowUp;
      });

    it("イベントを破棄する", ({ closedAcceptance }) => {
      expect(closedAcceptance).toBe(false);
    });

    it("後続ジョブを積まない", ({ closedEnqueueFollowUp }) => {
      expect(closedEnqueueFollowUp).not.toHaveBeenCalled();
    });
  });

  describe("レーンフィルタに落ちる PR", () => {
    const it = test.extend("filteredAcceptance", async () => {
      const gate = createLifecycleGate();
      const filteringQueue: JobQueue = {
        enqueue: () => true,
        enqueueFollowUp: () => true,
        setHandlers: () => undefined,
        runningLanes: () => [],
        waitingLanes: () => [],
        size: () => ({ waiting: 0, running: 0 }),
        isIdle: () => true,
        admitsLane: () => false,
        cancelLane: () => 0,
        drain: () => Promise.resolve(),
        reserveLane: () => Promise.resolve(null),
      };
      const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
      const coordinate = createReviewInputCoordinator({
        gate,
        queue: filteringQueue,
        stopSession,
        jobType: "review-input-changed",
        log: silentLogger,
      });
      return coordinate({ prNumber: 7, endpoint: "head" });
    });

    it("イベントを破棄する", ({ filteredAcceptance }) => {
      expect(filteredAcceptance).toBe(false);
    });
  });

  describe("実行中の PR", () => {
    const it = test
      .extend("runningGeneration", async () => {
        const gate = createLifecycleGate();
        const busyQueue: JobQueue = {
          enqueue: () => true,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => ["pr-7"],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 1 }),
          isIdle: () => false,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        };
        const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
        const coordinate = createReviewInputCoordinator({
          gate,
          queue: busyQueue,
          stopSession,
          jobType: "review-input-changed",
          log: silentLogger,
        });
        await coordinate({ prNumber: 7, endpoint: "head" });
        return gate.generationOf(7);
      })
      .extend("runningStopSession", async () => {
        const gate = createLifecycleGate();
        const busyQueue: JobQueue = {
          enqueue: () => true,
          enqueueFollowUp: () => true,
          setHandlers: () => undefined,
          runningLanes: () => ["pr-7"],
          waitingLanes: () => [],
          size: () => ({ waiting: 0, running: 1 }),
          isIdle: () => false,
          admitsLane: () => true,
          cancelLane: () => 0,
          drain: () => Promise.resolve(),
          reserveLane: () => Promise.resolve(null),
        };
        const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
        const coordinate = createReviewInputCoordinator({
          gate,
          queue: busyQueue,
          stopSession,
          jobType: "review-input-changed",
          log: silentLogger,
        });
        await coordinate({ prNumber: 7, endpoint: "head" });
        return stopSession;
      });

    it("世代を 1 つ進める", ({ runningGeneration }) => {
      expect(runningGeneration).toBe(1);
    });

    it("セッション停止を 1 回呼ぶ", ({ runningStopSession }) => {
      expect(runningStopSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("後続を拒むキュー", () => {
    const it = test.extend("refusedAcceptance", async () => {
      const gate = createLifecycleGate();
      const refusingQueue: JobQueue = {
        enqueue: () => true,
        enqueueFollowUp: () => false,
        setHandlers: () => undefined,
        runningLanes: () => [],
        waitingLanes: () => [],
        size: () => ({ waiting: 0, running: 0 }),
        isIdle: () => true,
        admitsLane: () => true,
        cancelLane: () => 0,
        drain: () => Promise.resolve(),
        reserveLane: () => Promise.resolve(null),
      };
      const stopSession = vi.fn<(prNumber: number) => Promise<void>>(() => Promise.resolve());
      const coordinate = createReviewInputCoordinator({
        gate,
        queue: refusingQueue,
        stopSession,
        jobType: "review-input-changed",
        log: silentLogger,
      });
      return coordinate({ prNumber: 7, endpoint: "head" });
    });

    it("受理しない", ({ refusedAcceptance }) => {
      expect(refusedAcceptance).toBe(false);
    });
  });
});
