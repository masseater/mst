import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { runConnectionCycle } from "./connection-cycle.ts";
import { createRestartRequest } from "./restart-request.ts";

import type { EventDispatcher } from "./event-dispatch.ts";

describe("runConnectionCycle の通常経路", () => {
  describe("巻き取りも購読も空のサイクル", () => {
    const it = test
      .extend("emptyCycleEnding", () =>
        runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield* [];
          },
          dispatcher: { dispatch: () => true },
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
          restart: createRestartRequest({ onRequest: () => undefined }),
          onActivity: () => undefined,
          signalled: () => false,
          log: silentLogger,
        }))
      .extend("emptyCycleMainSync", async () => {
        const mainSync = vi.fn<() => Promise<void>>(() => Promise.resolve());
        await runConnectionCycle({
          mode: "reviewer",
          syncMain: mainSync,
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield* [];
          },
          dispatcher: { dispatch: () => true },
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
          restart: createRestartRequest({ onRequest: () => undefined }),
          onActivity: () => undefined,
          signalled: () => false,
          log: silentLogger,
        });
        return mainSync;
      })
      .extend("emptyCycleQueueDrain", async () => {
        const queueDrain = vi.fn<() => Promise<void>>(() => Promise.resolve());
        await runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield* [];
          },
          dispatcher: { dispatch: () => true },
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
            drain: queueDrain,
            reserveLane: () => Promise.resolve(null),
          },
          restart: createRestartRequest({ onRequest: () => undefined }),
          onActivity: () => undefined,
          signalled: () => false,
          log: silentLogger,
        });
        return queueDrain;
      });

    it("ストリームが尽きたら stream-ended を返す", ({ emptyCycleEnding }) => {
      expect(emptyCycleEnding).toStrictEqual("stream-ended");
    });

    it("サイクル開始時に main へ同期する", ({ emptyCycleMainSync }) => {
      expect(emptyCycleMainSync).toHaveBeenCalledTimes(1);
    });

    it("ストリーム終了ではキューを排出してから戻る", ({ emptyCycleQueueDrain }) => {
      expect(emptyCycleQueueDrain).toHaveBeenCalledTimes(1);
    });
  });

  describe("巻き取りに購読対象が 1 件あるサイクル", () => {
    const it = test.extend("drainedCycleDispatch", async () => {
      const dispatchEvent = vi.fn<EventDispatcher["dispatch"]>(() => true);
      await runConnectionCycle({
        mode: "reviewer",
        syncMain: () => Promise.resolve(),
        startupDrain: () =>
          Promise.resolve([
            {
              event_type: "pull_request",
              delivery_id: "d-1",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            },
          ]),
        connect: () => Promise.resolve(),
        subscribe: async function* subscribe() {
          await Promise.resolve();
          yield* [];
        },
        dispatcher: { dispatch: dispatchEvent },
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
        restart: createRestartRequest({ onRequest: () => undefined }),
        onActivity: () => undefined,
        signalled: () => false,
        log: silentLogger,
      });
      return dispatchEvent;
    });

    it("巻き取ったイベントを投入する", ({ drainedCycleDispatch }) => {
      expect(drainedCycleDispatch).toHaveBeenCalledTimes(1);
    });
  });

  describe("購読で 2 件届くサイクル", () => {
    const it = test
      .extend("streamedCycleActivity", async () => {
        const recordActivity = vi.fn<() => void>();
        await runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield {
              event_type: "pull_request",
              delivery_id: "d-2",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
            yield {
              event_type: "pull_request",
              delivery_id: "d-3",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
          },
          dispatcher: { dispatch: () => true },
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
          restart: createRestartRequest({ onRequest: () => undefined }),
          onActivity: recordActivity,
          signalled: () => false,
          log: silentLogger,
        });
        return recordActivity;
      })
      .extend("streamedCycleDispatch", async () => {
        const dispatchEvent = vi.fn<EventDispatcher["dispatch"]>(() => true);
        await runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield {
              event_type: "pull_request",
              delivery_id: "d-2",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
            yield {
              event_type: "pull_request",
              delivery_id: "d-3",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
          },
          dispatcher: { dispatch: dispatchEvent },
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
          restart: createRestartRequest({ onRequest: () => undefined }),
          onActivity: () => undefined,
          signalled: () => false,
          log: silentLogger,
        });
        return dispatchEvent;
      });

    it("購読したイベント 1 件ごとに活動を記録する", ({ streamedCycleActivity }) => {
      expect(streamedCycleActivity).toHaveBeenCalledTimes(2);
    });

    it("購読したイベントを順に投入する", ({ streamedCycleDispatch }) => {
      expect(streamedCycleDispatch).toHaveBeenCalledTimes(2);
    });
  });

  describe("購読で種別の合わないイベントだけが届くサイクル", () => {
    const it = test.extend("unknownEventCycleDispatch", async () => {
      const dispatchEvent = vi.fn<EventDispatcher["dispatch"]>(() => true);
      await runConnectionCycle({
        mode: "reviewer",
        syncMain: () => Promise.resolve(),
        startupDrain: () => Promise.resolve([]),
        connect: () => Promise.resolve(),
        subscribe: async function* subscribe() {
          await Promise.resolve();
          yield { event_type: "ping" };
        },
        dispatcher: { dispatch: dispatchEvent },
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
        restart: createRestartRequest({ onRequest: () => undefined }),
        onActivity: () => undefined,
        signalled: () => false,
        log: silentLogger,
      });
      return dispatchEvent;
    });

    it("種別が合わないイベントは投入しない", ({ unknownEventCycleDispatch }) => {
      expect(unknownEventCycleDispatch).toHaveBeenCalledTimes(0);
    });
  });

  describe("巻き取りに種別外が混ざるサイクル", () => {
    const it = test.extend("mixedDrainCycleDispatch", async () => {
      const dispatchEvent = vi.fn<EventDispatcher["dispatch"]>(() => true);
      await runConnectionCycle({
        mode: "reviewer",
        syncMain: () => Promise.resolve(),
        startupDrain: () =>
          Promise.resolve([
            {
              event_type: "pull_request",
              delivery_id: "d-9",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            },
            { event_type: "ping" },
          ]),
        connect: () => Promise.resolve(),
        subscribe: async function* subscribe() {
          await Promise.resolve();
          yield* [];
        },
        dispatcher: { dispatch: dispatchEvent },
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
        restart: createRestartRequest({ onRequest: () => undefined }),
        onActivity: () => undefined,
        signalled: () => false,
        log: silentLogger,
      });
      return dispatchEvent;
    });

    it("巻き取りに種別外が混ざっても選別を通った分だけ投入する", ({ mixedDrainCycleDispatch }) => {
      expect(mixedDrainCycleDispatch).toHaveBeenCalledTimes(1);
    });
  });
});

describe("runConnectionCycle の中断", () => {
  describe("購読の途中でシグナルが立つサイクル", () => {
    const it = test
      .extend("signalledCycleEnding", () => {
        const recordActivity = vi.fn<() => void>();
        return runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield {
              event_type: "pull_request",
              delivery_id: "d-4",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
            yield {
              event_type: "pull_request",
              delivery_id: "d-5",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
          },
          dispatcher: { dispatch: () => true },
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
          restart: createRestartRequest({ onRequest: () => undefined }),
          onActivity: recordActivity,
          signalled: () => recordActivity.mock.calls.length >= 1,
          log: silentLogger,
        });
      })
      .extend("signalledCycleQueueDrain", async () => {
        const recordActivity = vi.fn<() => void>();
        const queueDrain = vi.fn<() => Promise<void>>(() => Promise.resolve());
        await runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield {
              event_type: "pull_request",
              delivery_id: "d-4",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
            yield {
              event_type: "pull_request",
              delivery_id: "d-5",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
          },
          dispatcher: { dispatch: () => true },
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
            drain: queueDrain,
            reserveLane: () => Promise.resolve(null),
          },
          restart: createRestartRequest({ onRequest: () => undefined }),
          onActivity: recordActivity,
          signalled: () => recordActivity.mock.calls.length >= 1,
          log: silentLogger,
        });
        return queueDrain;
      });

    it("シグナルを受けたら signalled を返す", ({ signalledCycleEnding }) => {
      expect(signalledCycleEnding).toStrictEqual("signalled");
    });

    it("シグナル終了ではキューを排出しない", ({ signalledCycleQueueDrain }) => {
      expect(signalledCycleQueueDrain).toHaveBeenCalledTimes(0);
    });
  });

  describe("購読の途中で再起動要求が立つサイクル", () => {
    const it = test
      .extend("restartedCycleEnding", () => {
        const restartRequest = createRestartRequest({ onRequest: () => undefined });
        return runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield {
              event_type: "pull_request",
              delivery_id: "d-6",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
            restartRequest.request("code-updated");
            yield {
              event_type: "pull_request",
              delivery_id: "d-7",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
          },
          dispatcher: { dispatch: () => true },
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
          restart: restartRequest,
          onActivity: () => undefined,
          signalled: () => false,
          log: silentLogger,
        });
      })
      .extend("restartedCycleQueueDrain", async () => {
        const restartRequest = createRestartRequest({ onRequest: () => undefined });
        const queueDrain = vi.fn<() => Promise<void>>(() => Promise.resolve());
        await runConnectionCycle({
          mode: "reviewer",
          syncMain: () => Promise.resolve(),
          startupDrain: () => Promise.resolve([]),
          connect: () => Promise.resolve(),
          subscribe: async function* subscribe() {
            await Promise.resolve();
            yield {
              event_type: "pull_request",
              delivery_id: "d-6",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
            restartRequest.request("code-updated");
            yield {
              event_type: "pull_request",
              delivery_id: "d-7",
              action: "review_requested",
              number: 7,
              pull_request: { number: 7, draft: false, title: "title" },
              requested_reviewer: { login: "review-bot" },
            };
          },
          dispatcher: { dispatch: () => true },
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
            drain: queueDrain,
            reserveLane: () => Promise.resolve(null),
          },
          restart: restartRequest,
          onActivity: () => undefined,
          signalled: () => false,
          log: silentLogger,
        });
        return queueDrain;
      });

    it("再起動要求を受けたら restart-requested を返す", ({ restartedCycleEnding }) => {
      expect(restartedCycleEnding).toStrictEqual("restart-requested");
    });

    it("再起動要求でもキューを排出しない", ({ restartedCycleQueueDrain }) => {
      expect(restartedCycleQueueDrain).toHaveBeenCalledTimes(0);
    });
  });

  describe("ストリーム終了直後にシグナルが立つサイクル", () => {
    const it = test.extend("signalledAfterStreamCycleEnding", () =>
      runConnectionCycle({
        mode: "reviewer",
        syncMain: () => Promise.resolve(),
        startupDrain: () => Promise.resolve([]),
        connect: () => Promise.resolve(),
        subscribe: async function* subscribe() {
          await Promise.resolve();
          yield* [];
        },
        dispatcher: { dispatch: () => true },
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
        restart: createRestartRequest({ onRequest: () => undefined }),
        onActivity: () => undefined,
        signalled: () => true,
        log: silentLogger,
      }));

    it("ストリーム終了直後のシグナルも signalled として拾う", ({
      signalledAfterStreamCycleEnding,
    }) => {
      expect(signalledAfterStreamCycleEnding).toStrictEqual("signalled");
    });
  });

  describe("ストリーム終了直後に再起動要求が立つサイクル", () => {
    const it = test.extend("restartedAfterStreamCycleEnding", () => {
      const restartRequest = createRestartRequest({ onRequest: () => undefined });
      return runConnectionCycle({
        mode: "reviewer",
        syncMain: () => Promise.resolve(),
        startupDrain: () => Promise.resolve([]),
        connect: () => Promise.resolve(),
        subscribe: async function* subscribe() {
          await Promise.resolve();
          yield {
            event_type: "pull_request",
            delivery_id: "d-8",
            action: "review_requested",
            number: 7,
            pull_request: { number: 7, draft: false, title: "title" },
            requested_reviewer: { login: "review-bot" },
          };
          restartRequest.request("idle");
        },
        dispatcher: { dispatch: () => true },
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
        restart: restartRequest,
        onActivity: () => undefined,
        signalled: () => false,
        log: silentLogger,
      });
    });

    it("ストリーム終了直後の再起動要求も restart-requested として拾う", ({
      restartedAfterStreamCycleEnding,
    }) => {
      expect(restartedAfterStreamCycleEnding).toStrictEqual("restart-requested");
    });
  });
});
