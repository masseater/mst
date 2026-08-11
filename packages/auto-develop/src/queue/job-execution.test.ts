import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { HaltQueueKeepJobError } from "./halt-disposition.ts";
import { createJobExecution, type QueueSharedState } from "./job-execution.ts";
import { createJobLedger, type JobRecord } from "./job-ledger.ts";

const record = (id: string, shape: Partial<Omit<JobRecord, "id">> = {}): JobRecord => ({
  id,
  type: "pr-events",
  payload: { jobId: id },
  key: `key-${id}`,
  lane: `lane-${id}`,
  label: `job ${id}`,
  state: "waiting",
  acceptedAt: "2026-08-11T00:00:00.000Z",
  ...shape,
});

const sharedState = (
  handler: (payload: unknown) => Promise<void>,
  onHalt?: (failure: unknown) => void,
): QueueSharedState => ({
  ledger: createJobLedger(),
  flags: new Map([["halted", false]]),
  reservedLanes: new Set<string>(),
  drainWaiters: new Set<() => void>(),
  handlerTable: new Map([["pr-events", handler]]),
  onHaltCell: new Map([["cb", onHalt]]),
});

const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("pump", () => {
  test("待機ジョブは到着順に並行度上限まで起動される", async () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const state = sharedState(handled);
    const execution = createJobExecution({
      state,
      concurrency: 2,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.ledger.put(record("job-1"));
    state.ledger.put(record("job-2"));
    state.ledger.put(record("job-3"));
    execution.pump();
    await settle();
    expect(handled.mock.calls.map(([payload]) => payload)).toStrictEqual([
      { jobId: "job-1" },
      { jobId: "job-2" },
      { jobId: "job-3" },
    ]);
  });

  test("実行中のレーンと予約中のレーンの待機ジョブは飛ばされる", () => {
    const state = sharedState(() => new Promise<void>(() => undefined));
    const execution = createJobExecution({
      state,
      concurrency: 3,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.ledger.put(record("job-1", { lane: "pr-7", state: "running" }));
    state.ledger.put(record("job-2", { lane: "pr-7" }));
    state.reservedLanes.add("pr-8");
    state.ledger.put(record("job-3", { lane: "pr-8" }));
    state.ledger.put(record("job-4", { lane: "pr-9" }));
    execution.pump();
    expect(
      state.ledger
        .records()
        .filter((stored) => stored.state === "running")
        .map((stored) => stored.id),
    ).toStrictEqual(["job-1", "job-4"]);
  });

  test("恒久停止中は何も起動されない", () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.resolve());
    const state = sharedState(handled);
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.flags.set("halted", true);
    state.ledger.put(record("job-1"));
    execution.pump();
    expect(handled).not.toHaveBeenCalled();
  });

  test("処理本体が未登録の型はエラーログで消費されキューは落ちない", async () => {
    const log = { ...silentLogger, error: vi.fn<(typeof silentLogger)["error"]>() };
    const state = sharedState(() => Promise.resolve());
    state.handlerTable.clear();
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log,
    });
    state.ledger.put(record("job-1"));
    execution.pump();
    await settle();
    expect([state.ledger.records(), log.error.mock.calls.length]).toStrictEqual([[], 1]);
  });
});

describe("失敗の扱い", () => {
  test("1 件の失敗はキューを止めず次のジョブが処理される", async () => {
    const handled = vi.fn<(payload: unknown) => Promise<void>>((payload) =>
      (payload as { readonly jobId: string }).jobId === "job-1"
        ? Promise.reject(new Error("flaky"))
        : Promise.resolve(),
    );
    const state = sharedState(handled);
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.ledger.put(record("job-1"));
    state.ledger.put(record("job-2"));
    execution.pump();
    await settle();
    expect([handled.mock.calls.length, state.ledger.records()]).toStrictEqual([2, []]);
  });

  test("恒久的失敗はジョブを待機に戻し全レーンの起動を止め通知先を 1 回呼ぶ", async () => {
    const onHalt = vi.fn<(failure: unknown) => void>();
    const haltFailure = new HaltQueueKeepJobError("engine auth expired");
    const handled = vi.fn<(payload: unknown) => Promise<void>>(() => Promise.reject(haltFailure));
    const state = sharedState(handled, onHalt);
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.ledger.put(record("job-1"));
    state.ledger.put(record("job-2"));
    execution.pump();
    await settle();
    expect([
      state.ledger.records().map((stored) => [stored.id, stored.state]),
      onHalt.mock.calls,
      handled.mock.calls.length,
    ]).toStrictEqual([
      [
        ["job-1", "waiting"],
        ["job-2", "waiting"],
      ],
      [[haltFailure]],
      1,
    ]);
  });

  test("取り消し済みのジョブが恒久的失敗を返しても待機へは戻らない", async () => {
    const gate = new Map<string, () => void>();
    const onHalt = vi.fn<(failure: unknown) => void>();
    const state = sharedState(
      () =>
        new Promise<void>((_resolve, reject) => {
          gate.set("fail", () => {
            reject(new HaltQueueKeepJobError("engine auth expired"));
          });
        }),
      onHalt,
    );
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.ledger.put(record("job-1"));
    execution.pump();
    state.ledger.remove("job-1");
    gate.get("fail")?.();
    await settle();
    expect([state.ledger.records(), onHalt.mock.calls.length]).toStrictEqual([[], 1]);
  });

  test("取り消し済みの実行中ジョブの完了は完了処理を発生させない", async () => {
    const gate = new Map<string, () => void>();
    const state = sharedState(
      () =>
        new Promise<void>((resolve) => {
          gate.set("release", resolve);
        }),
    );
    const snapshotNow = vi.fn<() => void>();
    const execution = createJobExecution({ state, concurrency: 1, snapshotNow, log: silentLogger });
    state.ledger.put(record("job-1"));
    state.ledger.put(record("job-2", { lane: "lane-job-1" }));
    execution.pump();
    state.ledger.remove("job-1");
    gate.get("release")?.();
    await settle();
    expect(state.ledger.records().map((stored) => [stored.id, stored.state])).toStrictEqual([
      ["job-2", "waiting"],
    ]);
  });
});

describe("drain 判定", () => {
  test("実行中も予約も待機も無ければ捌けている", () => {
    const state = sharedState(() => Promise.resolve());
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    expect(execution.isDrained()).toStrictEqual(true);
  });

  test("恒久停止中は待機が残っていても捌けたとみなす", () => {
    const state = sharedState(() => Promise.resolve());
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.ledger.put(record("job-1"));
    state.flags.set("halted", true);
    expect(execution.isDrained()).toStrictEqual(true);
  });

  test("予約中は捌けていない", () => {
    const state = sharedState(() => Promise.resolve());
    const execution = createJobExecution({
      state,
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    });
    state.reservedLanes.add("pr-7");
    const waiter = vi.fn<() => void>();
    state.drainWaiters.add(waiter);
    execution.notifyDrain();
    expect([execution.isDrained(), waiter.mock.calls.length]).toStrictEqual([false, 0]);
  });
});
