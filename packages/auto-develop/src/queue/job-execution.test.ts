import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { HaltQueueKeepJobError } from "./halt-disposition.ts";
import { createJobExecution, type QueueSharedState } from "./job-execution.ts";
import { createJobLedger } from "./job-ledger.ts";

const haltFailure = new HaltQueueKeepJobError("engine auth expired");

describe("pump", () => {
  const it = test
    .extend("arrivalOrderHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", handled]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 2,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-2",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-3",
        type: "pr-events",
        payload: { jobId: "job-3" },
        key: "key-job-3",
        lane: "lane-job-3",
        label: "job job-3",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return handled;
    })
    .extend("recordsAfterBusyAndReservedPump", () => {
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(["pr-8"]),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => new Promise<void>(() => undefined)]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 3,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "pr-7",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-3",
        type: "pr-events",
        payload: { jobId: "job-3" },
        key: "key-job-3",
        lane: "pr-8",
        label: "job job-3",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-4",
        type: "pr-events",
        payload: { jobId: "job-4" },
        key: "key-job-4",
        lane: "pr-9",
        label: "job job-4",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      return heldState.ledger.records();
    })
    .extend("haltedPumpHandler", () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", true]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", handled]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      return handled;
    })
    .extend("recordsAfterUnregisteredTypePump", async () => {
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map(),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return heldState.ledger.records();
    })
    .extend("unregisteredTypeErrorLog", async () => {
      const errorLog = vi.fn<(typeof silentLogger)["error"]>();
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map(),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: { ...silentLogger, error: errorLog },
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return errorLog;
    });

  it("待機ジョブは並行度上限を超えても到着順にすべて起動される", ({ arrivalOrderHandler }) => {
    expect(arrivalOrderHandler).toHaveBeenCalledTimes(3);
  });

  it("最初に到着した待機ジョブが 1 番目に起動される", ({ arrivalOrderHandler }) => {
    expect(arrivalOrderHandler).toHaveBeenNthCalledWith(1, { jobId: "job-1" });
  });

  it("2 番目に到着した待機ジョブが 2 番目に起動される", ({ arrivalOrderHandler }) => {
    expect(arrivalOrderHandler).toHaveBeenNthCalledWith(2, { jobId: "job-2" });
  });

  it("3 番目に到着した待機ジョブが 3 番目に起動される", ({ arrivalOrderHandler }) => {
    expect(arrivalOrderHandler).toHaveBeenNthCalledWith(3, { jobId: "job-3" });
  });

  it("実行中のレーンと予約中のレーンの待機ジョブは飛ばされる", ({
    recordsAfterBusyAndReservedPump,
  }) => {
    expect(recordsAfterBusyAndReservedPump).toStrictEqual([
      {
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
      {
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "pr-7",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
      {
        id: "job-3",
        type: "pr-events",
        payload: { jobId: "job-3" },
        key: "key-job-3",
        lane: "pr-8",
        label: "job job-3",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
      {
        id: "job-4",
        type: "pr-events",
        payload: { jobId: "job-4" },
        key: "key-job-4",
        lane: "pr-9",
        label: "job job-4",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
    ]);
  });

  it("恒久停止中は何も起動されない", ({ haltedPumpHandler }) => {
    expect(haltedPumpHandler).not.toHaveBeenCalled();
  });

  it("処理本体が未登録の型は消費されキューは落ちない", ({ recordsAfterUnregisteredTypePump }) => {
    expect(recordsAfterUnregisteredTypePump).toStrictEqual([]);
  });

  it("処理本体が未登録の型はエラーログに残る", ({ unregisteredTypeErrorLog }) => {
    expect(unregisteredTypeErrorLog).toHaveBeenCalledTimes(1);
  });
});

describe("失敗の扱い", () => {
  const it = test
    .extend("singleFailureHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>((carried) =>
        (carried as { readonly jobId: string }).jobId === "job-1"
          ? Promise.reject(new Error("flaky"))
          : Promise.resolve(),
      );
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", handled]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-2",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return handled;
    })
    .extend("recordsAfterSingleFailure", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>((carried) =>
        (carried as { readonly jobId: string }).jobId === "job-1"
          ? Promise.reject(new Error("flaky"))
          : Promise.resolve(),
      );
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", handled]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-2",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return heldState.ledger.records();
    })
    .extend("recordsAfterPermanentFailure", async () => {
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => Promise.reject(haltFailure)]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-2",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return heldState.ledger.records();
    })
    .extend("permanentFailureHaltNotice", async () => {
      const onHalt = vi.fn<(failure: unknown) => void>();
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => Promise.reject(haltFailure)]]),
        onHaltCell: new Map([["cb", onHalt]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-2",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return onHalt;
    })
    .extend("permanentFailureHandler", async () => {
      const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.reject(haltFailure));
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", handled]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-2",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return handled;
    })
    .extend("recordsAfterCanceledPermanentFailure", async () => {
      const failing = Promise.withResolvers<undefined>();
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => failing.promise]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      heldState.ledger.remove("job-1");
      failing.reject(new HaltQueueKeepJobError("engine auth expired"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return heldState.ledger.records();
    })
    .extend("canceledPermanentFailureHaltNotice", async () => {
      const failing = Promise.withResolvers<undefined>();
      const onHalt = vi.fn<(failure: unknown) => void>();
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => failing.promise]]),
        onHaltCell: new Map([["cb", onHalt]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      heldState.ledger.remove("job-1");
      failing.reject(new HaltQueueKeepJobError("engine auth expired"));
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return onHalt;
    })
    .extend("recordsAfterCanceledCompletion", async () => {
      const releasing = Promise.withResolvers<undefined>();
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => releasing.promise]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      heldState.ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-1",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      execution.pump();
      heldState.ledger.remove("job-1");
      releasing.resolve(undefined);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return heldState.ledger.records();
    });

  it("1 件の失敗はキューを止めず次のジョブが処理される", ({ singleFailureHandler }) => {
    expect(singleFailureHandler).toHaveBeenCalledTimes(2);
  });

  it("失敗したジョブも成功したジョブも記録から消える", ({ recordsAfterSingleFailure }) => {
    expect(recordsAfterSingleFailure).toStrictEqual([]);
  });

  it("恒久的失敗はジョブを待機に戻す", ({ recordsAfterPermanentFailure }) => {
    expect(recordsAfterPermanentFailure).toStrictEqual([
      {
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
      {
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-2",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
    ]);
  });

  it("恒久的失敗は通知先を 1 回呼ぶ", ({ permanentFailureHaltNotice }) => {
    expect(permanentFailureHaltNotice).toHaveBeenCalledExactlyOnceWith(haltFailure);
  });

  it("恒久的失敗の後は全レーンの起動が止まる", ({ permanentFailureHandler }) => {
    expect(permanentFailureHandler).toHaveBeenCalledTimes(1);
  });

  it("取り消し済みのジョブが恒久的失敗を返しても待機へは戻らない", ({
    recordsAfterCanceledPermanentFailure,
  }) => {
    expect(recordsAfterCanceledPermanentFailure).toStrictEqual([]);
  });

  it("取り消し済みのジョブの恒久的失敗も通知先を呼ぶ", ({ canceledPermanentFailureHaltNotice }) => {
    expect(canceledPermanentFailureHaltNotice).toHaveBeenCalledTimes(1);
  });

  it("取り消し済みの実行中ジョブの完了は完了処理を発生させない", ({
    recordsAfterCanceledCompletion,
  }) => {
    expect(recordsAfterCanceledCompletion).toStrictEqual([
      {
        id: "job-2",
        type: "pr-events",
        payload: { jobId: "job-2" },
        key: "key-job-2",
        lane: "lane-job-1",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
    ]);
  });
});

describe("drain 判定", () => {
  const it = test
    .extend("drainedWhenEmpty", () => {
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => Promise.resolve()]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      return execution.isDrained();
    })
    .extend("drainedWhileHalted", () => {
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", true]]),
        reservedLanes: new Set<string>(),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => Promise.resolve()]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      heldState.ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: { jobId: "job-1" },
        key: "key-job-1",
        lane: "lane-job-1",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return execution.isDrained();
    })
    .extend("drainedWhileReserved", () => {
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(["pr-7"]),
        drainWaiters: new Set<() => void>(),
        handlerTable: new Map([["pr-events", () => Promise.resolve()]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      return execution.isDrained();
    })
    .extend("reservedDrainWaiter", () => {
      const waiter = vi.fn<() => void>();
      const heldState: QueueSharedState = {
        ledger: createJobLedger(),
        flags: new Map([["halted", false]]),
        reservedLanes: new Set<string>(["pr-7"]),
        drainWaiters: new Set<() => void>([waiter]),
        handlerTable: new Map([["pr-events", () => Promise.resolve()]]),
        onHaltCell: new Map([["cb", undefined]]),
      };
      const execution = createJobExecution({
        state: heldState,
        concurrency: 1,
        snapshotNow: vi.fn<() => void>(),
        log: silentLogger,
      });
      execution.notifyDrain();
      return waiter;
    });

  it("実行中も予約も待機も無ければ捌けている", ({ drainedWhenEmpty }) => {
    expect(drainedWhenEmpty).toBe(true);
  });

  it("恒久停止中は待機が残っていても捌けたとみなす", ({ drainedWhileHalted }) => {
    expect(drainedWhileHalted).toBe(true);
  });

  it("予約中は捌けていない", ({ drainedWhileReserved }) => {
    expect(drainedWhileReserved).toBe(false);
  });

  it("予約中の drain 通知では待機者を起こさない", ({ reservedDrainWaiter }) => {
    expect(reservedDrainWaiter).not.toHaveBeenCalled();
  });
});
