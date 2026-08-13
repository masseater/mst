import { describe, expect, test } from "vite-plus/test";

import { createJobLedger } from "./job-ledger.ts";

describe("createJobLedger", () => {
  describe("別レーンの待機ジョブを 2 件書き込んだ台帳", () => {
    const it = test.extend("storedRecords", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.records();
    });

    it("追加した順に記録が読める", ({ storedRecords }) => {
      expect(storedRecords).toStrictEqual([
        {
          id: "job-1",
          type: "pr-events",
          payload: {},
          key: "key-job-1",
          lane: "pr-7",
          label: "job job-1",
          state: "waiting",
          acceptedAt: "2026-08-11T00:00:00.000Z",
        },
        {
          id: "job-2",
          type: "pr-events",
          payload: {},
          key: "key-job-2",
          lane: "pr-8",
          label: "job job-2",
          state: "waiting",
          acceptedAt: "2026-08-11T00:00:00.000Z",
        },
      ]);
    });
  });

  describe("待機 1 件と実行 1 件を書き込んだ台帳の待機数", () => {
    const it = test.extend("waitingCount", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.waitingCount();
    });

    it("待機を数える", ({ waitingCount }) => {
      expect(waitingCount).toStrictEqual(1);
    });
  });

  describe("待機 1 件と実行 1 件を書き込んだ台帳の実行数", () => {
    const it = test.extend("runningCount", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.runningCount();
    });

    it("実行を待機とは別に数える", ({ runningCount }) => {
      expect(runningCount).toStrictEqual(1);
    });
  });

  describe("実行ジョブを抱えたレーンの実行判定", () => {
    const it = test.extend("runningLaneIsRunning", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.laneRunning("pr-7");
    });

    it("実行中ジョブのあるレーンは実行中と判定される", ({ runningLaneIsRunning }) => {
      expect(runningLaneIsRunning).toStrictEqual(true);
    });
  });

  describe("待機ジョブしか抱えていないレーンの実行判定", () => {
    const it = test.extend("waitingOnlyLaneIsRunning", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.laneRunning("pr-8");
    });

    it("待機ジョブしかないレーンは実行中と判定されない", ({ waitingOnlyLaneIsRunning }) => {
      expect(waitingOnlyLaneIsRunning).toStrictEqual(false);
    });
  });

  describe("待機ジョブを抱えたレーンの待機判定", () => {
    const it = test.extend("waitingLaneIsWaiting", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.laneWaiting("pr-8");
    });

    it("待機ジョブのあるレーンは待機中と判定される", ({ waitingLaneIsWaiting }) => {
      expect(waitingLaneIsWaiting).toStrictEqual(true);
    });
  });

  describe("実行ジョブしか抱えていないレーンの待機判定", () => {
    const it = test.extend("runningOnlyLaneIsWaiting", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.laneWaiting("pr-7");
    });

    it("実行中ジョブしかないレーンは待機中と判定されない", ({ runningOnlyLaneIsWaiting }) => {
      expect(runningOnlyLaneIsWaiting).toStrictEqual(false);
    });
  });

  describe("ジョブを抱えたレーンの占有判定", () => {
    const it = test.extend("filledLaneIsOccupied", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.laneOccupied("pr-7");
    });

    it("ジョブのあるレーンは占有と判定される", ({ filledLaneIsOccupied }) => {
      expect(filledLaneIsOccupied).toStrictEqual(true);
    });
  });

  describe("ジョブを 1 件も抱えていないレーンの占有判定", () => {
    const it = test.extend("untouchedLaneIsOccupied", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-8",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.laneOccupied("pr-9");
    });

    it("ジョブの無いレーンは占有と判定されない", ({ untouchedLaneIsOccupied }) => {
      expect(untouchedLaneIsOccupied).toStrictEqual(false);
    });
  });

  describe("同じレーンに実行ジョブと待機ジョブが並んだ台帳の探索", () => {
    const it = test.extend("waitingJobOfSameTypeAndLane", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.put({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-7",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.findWaiting({ type: "pr-events", lane: "pr-7" });
    });

    it("同型同レーンの待機ジョブを探せる", ({ waitingJobOfSameTypeAndLane }) => {
      expect(waitingJobOfSameTypeAndLane).toStrictEqual({
        id: "job-2",
        type: "pr-events",
        payload: {},
        key: "key-job-2",
        lane: "pr-7",
        label: "job job-2",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
    });
  });

  describe("実行ジョブが持つキーの照会", () => {
    const it = test.extend("runningJobKeyIsKnown", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.hasKey("key-job-1");
    });

    it("実行中ジョブのキーも重複として検出する", ({ runningJobKeyIsKnown }) => {
      expect(runningJobKeyIsKnown).toStrictEqual(true);
    });
  });

  describe("どのジョブも持たないキーの照会", () => {
    const it = test.extend("absentKeyIsKnown", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.hasKey("key-unknown");
    });

    it("未登録のキーは重複として検出しない", ({ absentKeyIsKnown }) => {
      expect(absentKeyIsKnown).toStrictEqual(false);
    });
  });

  describe("書き込んだ直後のジョブの在籍照会", () => {
    const it = test.extend("storedJobIsPresent", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.has("job-1");
    });

    it("登録済みジョブは存在すると答える", ({ storedJobIsPresent }) => {
      expect(storedJobIsPresent).toStrictEqual(true);
    });
  });

  describe("書き込んだジョブへの 1 度目の削除", () => {
    const it = test.extend("firstRemoval", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      return ledger.remove("job-1");
    });

    it("削除は成功を返す", ({ firstRemoval }) => {
      expect(firstRemoval).toStrictEqual(true);
    });
  });

  describe("書き込んだジョブへの 2 度目の削除", () => {
    const it = test.extend("secondRemoval", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.remove("job-1");
      return ledger.remove("job-1");
    });

    it("2 度目の削除は失敗を返す", ({ secondRemoval }) => {
      expect(secondRemoval).toStrictEqual(false);
    });
  });

  describe("削除した後のジョブの取得", () => {
    const it = test.extend("lookupAfterRemoval", () => {
      const ledger = createJobLedger();
      ledger.put({
        id: "job-1",
        type: "pr-events",
        payload: {},
        key: "key-job-1",
        lane: "pr-7",
        label: "job job-1",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      });
      ledger.remove("job-1");
      return ledger.get("job-1");
    });

    it("不在の取得は undefined を返す", ({ lookupAfterRemoval }) => {
      expect(lookupAfterRemoval).toStrictEqual(undefined);
    });
  });
});
