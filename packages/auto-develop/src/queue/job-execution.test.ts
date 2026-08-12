import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { HaltQueueKeepJobError } from "./halt-disposition.ts";
import { createJobExecution, type QueueSharedState } from "./job-execution.ts";
import { createJobLedger, type JobRecord } from "./job-ledger.ts";

const written = (
  identity: string,
  shape: Partial<Omit<JobRecord, "identity">> = {},
): JobRecord => ({
  id: identity,
  type: "pr-events",
  payload: { jobId: identity },
  key: `key-${identity}`,
  lane: `lane-${identity}`,
  label: `job ${identity}`,
  state: "waiting",
  acceptedAt: "2026-08-11T00:00:00.000Z",
  ...shape,
});

const sharedState = (
  takenHandler: (payload: unknown) => Promise<void>,
  onHalt?: (failure: unknown) => void,
): QueueSharedState => ({
  ledger: createJobLedger(),
  flags: new Map([["halted", false]]),
  reservedLanes: new Set<string>(),
  drainWaiters: new Set<() => void>(),
  handlerTable: new Map([["pr-events", takenHandler]]),
  onHaltCell: new Map([["cb", onHalt]]),
});

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const haltFailure = new HaltQueueKeepJobError("engine auth expired");

const it = test
  .extend("arrivalOrderHandlerCalls", async () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const heldState = sharedState(handled);
    const execution = createJobExecution({
      state: heldState,
      concurrency: 2,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.ledger.put(written("job-1"));
    heldState.ledger.put(written("job-2"));
    heldState.ledger.put(written("job-3"));
    execution.pump();
    await settle();
    return handled.mock.calls;
  })
  .extend("recordsAfterBusyAndReservedPump", () => {
    const heldState = sharedState(() => new Promise<void>(() => undefined));
    const execution = createJobExecution({
      state: heldState,
      concurrency: 3,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.ledger.put(written("job-1", { lane: "pr-7", state: "running" }));
    heldState.ledger.put(written("job-2", { lane: "pr-7" }));
    heldState.reservedLanes.add("pr-8");
    heldState.ledger.put(written("job-3", { lane: "pr-8" }));
    heldState.ledger.put(written("job-4", { lane: "pr-9" }));
    execution.pump();
    return heldState.ledger.records();
  })
  .extend("haltedPumpHandlerCalls", () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const heldState = sharedState(handled);
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.flags.set("halted", true);
    heldState.ledger.put(written("job-1"));
    execution.pump();
    return handled.mock.calls;
  })
  .extend("unregisteredTypePump", async () => {
    const log = { ...silentLogger, error: vi.fn<(typeof silentLogger)["error"]>() };
    const heldState = sharedState(() => Promise.resolve());
    heldState.handlerTable.clear();
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log,
    });
    heldState.ledger.put(written("job-1"));
    execution.pump();
    await settle();
    return { records: heldState.ledger.records(), errorCalls: log.error.mock.calls };
  })
  .extend("runAfterSingleFailure", async () => {
    const handled = vi.fn<(carried: unknown) => Promise<void>>((carried) =>
      (carried as { readonly jobId: string }).jobId === "job-1"
        ? Promise.reject(new Error("flaky"))
        : Promise.resolve(),
    );
    const heldState = sharedState(handled);
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.ledger.put(written("job-1"));
    heldState.ledger.put(written("job-2"));
    execution.pump();
    await settle();
    return { handlerCalls: handled.mock.calls, records: heldState.ledger.records() };
  })
  .extend("permanentFailureRun", async () => {
    const onHalt = vi.fn<(failure: unknown) => void>();
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.reject(haltFailure));
    const heldState = sharedState(handled, onHalt);
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.ledger.put(written("job-1"));
    heldState.ledger.put(written("job-2"));
    execution.pump();
    await settle();
    return {
      records: heldState.ledger.records(),
      onHaltCalls: onHalt.mock.calls,
      handlerCalls: handled.mock.calls,
    };
  })
  .extend("canceledJobPermanentFailureRun", async () => {
    const gate = new Map<string, () => void>();
    const onHalt = vi.fn<(failure: unknown) => void>();
    const heldState = sharedState(
      () =>
        new Promise<void>((_resolve, reject) => {
          gate.set("fail", () => {
            reject(new HaltQueueKeepJobError("engine auth expired"));
          });
        }),
      onHalt,
    );
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.ledger.put(written("job-1"));
    execution.pump();
    heldState.ledger.remove("job-1");
    gate.get("fail")?.();
    await settle();
    return { records: heldState.ledger.records(), onHaltCalls: onHalt.mock.calls };
  })
  .extend("recordsAfterCanceledCompletion", async () => {
    const gate = new Map<string, () => void>();
    const heldState = sharedState(
      () =>
        new Promise<void>((resolve) => {
          gate.set("release", resolve);
        }),
    );
    const snapshotNow = vi.fn<() => void>();
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow,
      log: silentLogger,
    });
    heldState.ledger.put(written("job-1"));
    heldState.ledger.put(written("job-2", { lane: "lane-job-1" }));
    execution.pump();
    heldState.ledger.remove("job-1");
    gate.get("release")?.();
    await settle();
    return heldState.ledger.records();
  })
  .extend("drainedWhenEmpty", () => {
    const heldState = sharedState(() => Promise.resolve());
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    return execution.isDrained();
  })
  .extend("drainedWhileHalted", () => {
    const heldState = sharedState(() => Promise.resolve());
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.ledger.put(written("job-1"));
    heldState.flags.set("halted", true);
    return execution.isDrained();
  })
  .extend("drainWhileReserved", () => {
    const heldState = sharedState(() => Promise.resolve());
    const execution = createJobExecution({
      state: heldState,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    heldState.reservedLanes.add("pr-7");
    const waiter = vi.fn<() => void>();
    heldState.drainWaiters.add(waiter);
    execution.notifyDrain();
    return { drained: execution.isDrained(), waiterCalls: waiter.mock.calls };
  });

describe("pump", () => {
  it("待機ジョブは到着順に並行度上限まで起動される", ({ arrivalOrderHandlerCalls }) => {
    expect(arrivalOrderHandlerCalls).toStrictEqual([
      [{ jobId: "job-1" }],
      [{ jobId: "job-2" }],
      [{ jobId: "job-3" }],
    ]);
  });

  it("実行中のレーンと予約中のレーンの待機ジョブは飛ばされる", ({
    recordsAfterBusyAndReservedPump,
  }) => {
    expect(recordsAfterBusyAndReservedPump).toStrictEqual([
      written("job-1", { lane: "pr-7", state: "running" }),
      written("job-2", { lane: "pr-7" }),
      written("job-3", { lane: "pr-8" }),
      written("job-4", { lane: "pr-9", state: "running" }),
    ]);
  });

  it("恒久停止中は何も起動されない", ({ haltedPumpHandlerCalls }) => {
    expect(haltedPumpHandlerCalls).toStrictEqual([]);
  });

  it("処理本体が未登録の型は消費されキューは落ちない", ({ unregisteredTypePump }) => {
    expect(unregisteredTypePump.records).toStrictEqual([]);
  });

  it("処理本体が未登録の型はエラーログに残る", ({ unregisteredTypePump }) => {
    expect(unregisteredTypePump.errorCalls.length).toStrictEqual(1);
  });
});

describe("失敗の扱い", () => {
  it("1 件の失敗はキューを止めず次のジョブが処理される", ({ runAfterSingleFailure }) => {
    expect(runAfterSingleFailure.handlerCalls.length).toStrictEqual(2);
  });

  it("失敗したジョブも成功したジョブも記録から消える", ({ runAfterSingleFailure }) => {
    expect(runAfterSingleFailure.records).toStrictEqual([]);
  });

  it("恒久的失敗はジョブを待機に戻す", ({ permanentFailureRun }) => {
    expect(permanentFailureRun.records).toStrictEqual([written("job-1"), written("job-2")]);
  });

  it("恒久的失敗は通知先を 1 回呼ぶ", ({ permanentFailureRun }) => {
    expect(permanentFailureRun.onHaltCalls).toStrictEqual([[haltFailure]]);
  });

  it("恒久的失敗の後は全レーンの起動が止まる", ({ permanentFailureRun }) => {
    expect(permanentFailureRun.handlerCalls.length).toStrictEqual(1);
  });

  it("取り消し済みのジョブが恒久的失敗を返しても待機へは戻らない", ({
    canceledJobPermanentFailureRun,
  }) => {
    expect(canceledJobPermanentFailureRun.records).toStrictEqual([]);
  });

  it("取り消し済みのジョブの恒久的失敗も通知先を呼ぶ", ({ canceledJobPermanentFailureRun }) => {
    expect(canceledJobPermanentFailureRun.onHaltCalls.length).toStrictEqual(1);
  });

  it("取り消し済みの実行中ジョブの完了は完了処理を発生させない", ({
    recordsAfterCanceledCompletion,
  }) => {
    expect(recordsAfterCanceledCompletion).toStrictEqual([
      written("job-2", { lane: "lane-job-1" }),
    ]);
  });
});

describe("drain 判定", () => {
  it("実行中も予約も待機も無ければ捌けている", ({ drainedWhenEmpty }) => {
    expect(drainedWhenEmpty).toStrictEqual(true);
  });

  it("恒久停止中は待機が残っていても捌けたとみなす", ({ drainedWhileHalted }) => {
    expect(drainedWhileHalted).toStrictEqual(true);
  });

  it("予約中は捌けていない", ({ drainWhileReserved }) => {
    expect(drainWhileReserved.drained).toStrictEqual(false);
  });

  it("予約中の drain 通知では待機者を起こさない", ({ drainWhileReserved }) => {
    expect(drainWhileReserved.waiterCalls.length).toStrictEqual(0);
  });
});
