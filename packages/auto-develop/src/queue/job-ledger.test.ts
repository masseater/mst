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

describe("createJobLedger", () => {
  test("追加した順に記録が読める", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1"));
    ledger.put(record("job-2", { lane: "pr-8" }));
    expect(ledger.records().map((stored) => stored.id)).toStrictEqual(["job-1", "job-2"]);
  });

  test("待機と実行を別々に数える", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1"));
    ledger.put(record("job-2", { lane: "pr-8", state: "running" }));
    expect([ledger.waitingCount(), ledger.runningCount()]).toStrictEqual([1, 1]);
  });

  test("レーンの実行中と待機中と占有を判定できる", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1", { state: "running" }));
    ledger.put(record("job-2", { lane: "pr-8" }));
    expect([
      ledger.laneRunning("pr-7"),
      ledger.laneRunning("pr-8"),
      ledger.laneWaiting("pr-8"),
      ledger.laneWaiting("pr-7"),
      ledger.laneOccupied("pr-7"),
      ledger.laneOccupied("pr-9"),
    ]).toStrictEqual([true, false, true, false, true, false]);
  });

  test("同型同レーンの待機ジョブを探せる", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1", { state: "running" }));
    ledger.put(record("job-2"));
    expect(ledger.findWaiting({ type: "pr-events", lane: "pr-7" })?.id).toStrictEqual("job-2");
  });

  test("キーの重複を待機実行を問わず検出する", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1", { state: "running" }));
    expect([ledger.hasKey("key-job-1"), ledger.hasKey("key-unknown")]).toStrictEqual([true, false]);
  });

  test("削除は成否を返し取得は不在で undefined を返す", () => {
    const ledger = createJobLedger();
    ledger.put(record("job-1"));
    expect([
      ledger.has("job-1"),
      ledger.remove("job-1"),
      ledger.remove("job-1"),
      ledger.get("job-1"),
    ]).toStrictEqual([true, true, false, undefined]);
  });
});
