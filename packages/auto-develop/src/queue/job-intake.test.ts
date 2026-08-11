import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createJobExecution } from "./job-execution.ts";
import { createJobIntakeDesk, type JobIntake } from "./job-intake.ts";
import { createJobLedger, type JobLedger } from "./job-ledger.ts";

const intake = (shape: Partial<JobIntake> = {}): JobIntake => ({
  type: "pr-events",
  payload: { revision: 1 },
  key: "key-1",
  lane: "pr-7",
  label: "pr-events for PR #7",
  ...shape,
});

const deskWith = (desk: {
  readonly ledger: JobLedger;
  readonly coalesce?: Parameters<typeof createJobIntakeDesk>[0]["coalesce"];
  readonly waitingSerializedTypes?: readonly string[];
  readonly prFilter?: Parameters<typeof createJobIntakeDesk>[0]["prFilter"];
}) =>
  createJobIntakeDesk({
    ledger: desk.ledger,
    execution: createJobExecution({
      state: {
        ledger: desk.ledger,
        flags: new Map([["halted", true]]),
        reservedLanes: new Set(),
        drainWaiters: new Set(),
        handlerTable: new Map(),
        onHaltCell: new Map([["cb", undefined]]),
      },
      concurrency: 1,
      snapshotNow: vi.fn<() => void>(),
      log: silentLogger,
    }),
    snapshotNow: vi.fn<() => void>(),
    log: silentLogger,
    coalesce: desk.coalesce ?? {},
    waitingSerializedTypes: desk.waitingSerializedTypes ?? [],
    prFilter: desk.prFilter,
    nowIso: () => "2026-08-11T00:00:00.000Z",
    nextId: (() => {
      const counter = new Map([["next", 1]]);
      return () => {
        const idNumber = counter.get("next") as number;
        counter.set("next", idNumber + 1);
        return `job-${idNumber}`;
      };
    })(),
  });

describe("通常受付", () => {
  test("空きレーンへの受付は待機ジョブとして積まれる", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    expect([desk.enqueue(intake()), ledger.waitingCount()]).toStrictEqual([true, 1]);
  });

  test("同じキーの再受付は待機実行を問わず却下される", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    desk.enqueue(intake());
    expect(desk.enqueue(intake({ lane: "pr-8" }))).toStrictEqual(false);
  });

  test("実行中レーンへの別キー受付は破棄される", () => {
    const ledger = createJobLedger();
    ledger.put({
      id: "job-running",
      type: "pr-events",
      payload: {},
      key: "key-running",
      lane: "pr-7",
      label: "running",
      state: "running",
      acceptedAt: "2026-08-11T00:00:00.000Z",
    });
    const desk = deskWith({ ledger });
    expect(desk.enqueue(intake({ key: "key-2" }))).toStrictEqual(false);
  });

  test("待機中レーンへの受付は直列化を許さない型では破棄される", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    desk.enqueue(intake());
    expect(desk.enqueue(intake({ key: "key-2" }))).toStrictEqual(false);
  });

  test("待機直列化を許す型は同レーンの待機に到着順で並ぶ", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, waitingSerializedTypes: ["pr-events"] });
    desk.enqueue(intake());
    expect([desk.enqueue(intake({ key: "key-2" })), ledger.waitingCount()]).toStrictEqual([
      true,
      2,
    ]);
  });

  test("PR フィルタに落ちるレーンは受付時点で却下される", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, prFilter: { targetPrs: [], excludedPrs: [7] } });
    expect([desk.enqueue(intake()), ledger.records()]).toStrictEqual([false, []]);
  });
});

describe("畳み込み受付", () => {
  const coalesce = {
    "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
      merged: [existingPayload, incomingPayload],
    }),
  };

  test("同型同レーンの待機ジョブがあればペイロードを結合して受理する", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, coalesce });
    desk.enqueue(intake({ payload: { revision: 1 } }));
    const accepted = desk.enqueue(intake({ key: "key-2", payload: { revision: 2 } }));
    expect([accepted, ledger.waitingCount(), ledger.records()[0]?.payload]).toStrictEqual([
      true,
      1,
      { merged: [{ revision: 1 }, { revision: 2 }] },
    ]);
  });

  test("待機がなくレーンが実行中なら破棄する", () => {
    const ledger = createJobLedger();
    ledger.put({
      id: "job-running",
      type: "pr-events",
      payload: {},
      key: "key-running",
      lane: "pr-7",
      label: "running",
      state: "running",
      acceptedAt: "2026-08-11T00:00:00.000Z",
    });
    const desk = deskWith({ ledger, coalesce });
    expect(desk.enqueue(intake({ key: "key-2" }))).toStrictEqual(false);
  });

  test("レーンが空いていれば新規待機ジョブとして積む", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, coalesce });
    expect([desk.enqueue(intake()), ledger.waitingCount()]).toStrictEqual([true, 1]);
  });
});

describe("後続受付", () => {
  test("同型同レーンの待機ジョブは内容ごと最新に差し替わり位置と ID を保つ", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    desk.enqueue(intake({ payload: { revision: 1 } }));
    const accepted = desk.enqueueFollowUp(
      intake({ key: "key-2", payload: { revision: 2 }, label: "latest input" }),
    );
    const [waiting] = ledger.records();
    expect([
      accepted,
      ledger.waitingCount(),
      waiting?.id,
      waiting?.payload,
      waiting?.key,
    ]).toStrictEqual([true, 1, "job-1", { revision: 2 }, "key-2"]);
  });

  test("レーンが実行中でも破棄せず真後ろに 1 件だけ並ぶ", () => {
    const ledger = createJobLedger();
    ledger.put({
      id: "job-running",
      type: "pr-events",
      payload: {},
      key: "key-running",
      lane: "pr-7",
      label: "running",
      state: "running",
      acceptedAt: "2026-08-11T00:00:00.000Z",
    });
    const desk = deskWith({ ledger });
    desk.enqueueFollowUp(intake({ key: "key-2", payload: { revision: 2 } }));
    desk.enqueueFollowUp(intake({ key: "key-3", payload: { revision: 3 } }));
    const waitingRecords = ledger.records().filter((stored) => stored.state === "waiting");
    expect([waitingRecords.length, waitingRecords[0]?.payload]).toStrictEqual([1, { revision: 3 }]);
  });

  test("後続受付にも PR フィルタは適用される", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, prFilter: { targetPrs: [9], excludedPrs: [] } });
    expect(desk.enqueueFollowUp(intake())).toStrictEqual(false);
  });
});
