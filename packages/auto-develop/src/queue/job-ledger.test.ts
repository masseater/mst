import { describe, expect, test } from "vite-plus/test";

import { createJobLedger, type JobRecord } from "./job-ledger.ts";

const record = (id: string, shape: Partial<Omit<JobRecord, "id">> = {}): JobRecord => ({
  id,
  type: "pr-events",
  payload: {},
  key: `key-${id}`,
  lane: "pr-7",
  label: `job ${id}`,
  state: "waiting",
  acceptedAt: "2026-08-11T00:00:00.000Z",
  ...shape,
});

const it = test
  .extend("storedRecords", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1"));
    ledger.put(record("job-2", { lane: "pr-8" }));
    return ledger.records();
  })
  .extend("stateCounts", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1"));
    ledger.put(record("job-2", { lane: "pr-8", state: "running" }));
    return { waiting: ledger.waitingCount(), running: ledger.runningCount() };
  })
  .extend("laneStates", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1", { state: "running" }));
    ledger.put(record("job-2", { lane: "pr-8" }));
    return {
      runningLane: ledger.laneRunning("pr-7"),
      waitingOnlyLaneRunning: ledger.laneRunning("pr-8"),
      waitingLane: ledger.laneWaiting("pr-8"),
      runningLaneWaiting: ledger.laneWaiting("pr-7"),
      occupiedLane: ledger.laneOccupied("pr-7"),
      untouchedLane: ledger.laneOccupied("pr-9"),
    };
  })
  .extend("waitingSameTypeAndLane", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1", { state: "running" }));
    ledger.put(record("job-2"));
    return ledger.findWaiting({ type: "pr-events", lane: "pr-7" });
  })
  .extend("keyPresence", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1", { state: "running" }));
    return { known: ledger.hasKey("key-job-1"), unknown: ledger.hasKey("key-unknown") };
  })
  .extend("removalAndLookup", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1"));
    return {
      presentBeforeRemoval: ledger.has("job-1"),
      firstRemoval: ledger.remove("job-1"),
      secondRemoval: ledger.remove("job-1"),
      lookupAfterRemoval: ledger.get("job-1"),
    };
  });

describe("createJobLedger", () => {
  it("追加した順に記録が読める", ({ storedRecords }) => {
    expect(storedRecords).toStrictEqual([record("job-1"), record("job-2", { lane: "pr-8" })]);
  });

  it("待機を数える", ({ stateCounts }) => {
    expect(stateCounts.waiting).toStrictEqual(1);
  });

  it("実行を待機とは別に数える", ({ stateCounts }) => {
    expect(stateCounts.running).toStrictEqual(1);
  });

  it("実行中ジョブのあるレーンは実行中と判定される", ({ laneStates }) => {
    expect(laneStates.runningLane).toStrictEqual(true);
  });

  it("待機ジョブしかないレーンは実行中と判定されない", ({ laneStates }) => {
    expect(laneStates.waitingOnlyLaneRunning).toStrictEqual(false);
  });

  it("待機ジョブのあるレーンは待機中と判定される", ({ laneStates }) => {
    expect(laneStates.waitingLane).toStrictEqual(true);
  });

  it("実行中ジョブしかないレーンは待機中と判定されない", ({ laneStates }) => {
    expect(laneStates.runningLaneWaiting).toStrictEqual(false);
  });

  it("ジョブのあるレーンは占有と判定される", ({ laneStates }) => {
    expect(laneStates.occupiedLane).toStrictEqual(true);
  });

  it("ジョブの無いレーンは占有と判定されない", ({ laneStates }) => {
    expect(laneStates.untouchedLane).toStrictEqual(false);
  });

  it("同型同レーンの待機ジョブを探せる", ({ waitingSameTypeAndLane }) => {
    expect(waitingSameTypeAndLane?.id).toStrictEqual("job-2");
  });

  it("実行中ジョブのキーも重複として検出する", ({ keyPresence }) => {
    expect(keyPresence.known).toStrictEqual(true);
  });

  it("未登録のキーは重複として検出しない", ({ keyPresence }) => {
    expect(keyPresence.unknown).toStrictEqual(false);
  });

  it("登録済みジョブは存在すると答える", ({ removalAndLookup }) => {
    expect(removalAndLookup.presentBeforeRemoval).toStrictEqual(true);
  });

  it("削除は成功を返す", ({ removalAndLookup }) => {
    expect(removalAndLookup.firstRemoval).toStrictEqual(true);
  });

  it("2 度目の削除は失敗を返す", ({ removalAndLookup }) => {
    expect(removalAndLookup.secondRemoval).toStrictEqual(false);
  });

  it("不在の取得は undefined を返す", ({ removalAndLookup }) => {
    expect(removalAndLookup.lookupAfterRemoval).toStrictEqual(undefined);
  });
});
