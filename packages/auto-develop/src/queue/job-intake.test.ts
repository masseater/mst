import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createJobExecution } from "./job-execution.ts";
import { createJobIntakeDesk, type JobIntake } from "./job-intake.ts";
import { createJobLedger, type JobLedger, type JobRecord } from "./job-ledger.ts";

const intake = (shape: Partial<JobIntake> = {}): JobIntake => ({
  type: "pr-events",
  payload: { revision: 1 },
  key: "key-1",
  lane: "pr-7",
  label: "pr-events for PR #7",
  ...shape,
});

const runningRecord = (): JobRecord => ({
  id: "job-running",
  type: "pr-events",
  payload: {},
  key: "key-running",
  lane: "pr-7",
  label: "running",
  state: "running",
  acceptedAt: "2026-08-11T00:00:00.000Z",
});

const coalesce = {
  "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
    merged: [existingPayload, incomingPayload],
  }),
};

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

const it = test
  .extend("freeLaneIntake", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    return { accepted: desk.enqueue(intake()), waitingCount: ledger.waitingCount() };
  })
  .extend("duplicateKeyIntake", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    desk.enqueue(intake());
    return desk.enqueue(intake({ lane: "pr-8" }));
  })
  .extend("runningLaneIntake", () => {
    const ledger = createJobLedger();
    ledger.put(runningRecord());
    const desk = deskWith({ ledger });
    return desk.enqueue(intake({ key: "key-2" }));
  })
  .extend("waitingLaneIntake", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    desk.enqueue(intake());
    return desk.enqueue(intake({ key: "key-2" }));
  })
  .extend("serializedWaitingIntake", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, waitingSerializedTypes: ["pr-events"] });
    desk.enqueue(intake());
    return {
      accepted: desk.enqueue(intake({ key: "key-2" })),
      waitingCount: ledger.waitingCount(),
    };
  })
  .extend("filteredLaneIntake", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, prFilter: { targetPrs: [], excludedPrs: [7] } });
    return { accepted: desk.enqueue(intake()), records: ledger.records() };
  })
  .extend("coalescedIntake", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, coalesce });
    desk.enqueue(intake({ payload: { revision: 1 } }));
    const accepted = desk.enqueue(intake({ key: "key-2", payload: { revision: 2 } }));
    return { accepted, waitingCount: ledger.waitingCount(), records: ledger.records() };
  })
  .extend("coalesceOnRunningLane", () => {
    const ledger = createJobLedger();
    ledger.put(runningRecord());
    const desk = deskWith({ ledger, coalesce });
    return desk.enqueue(intake({ key: "key-2" }));
  })
  .extend("coalesceOnFreeLane", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, coalesce });
    return { accepted: desk.enqueue(intake()), waitingCount: ledger.waitingCount() };
  })
  .extend("followUpReplacement", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger });
    desk.enqueue(intake({ payload: { revision: 1 } }));
    const accepted = desk.enqueueFollowUp(
      intake({ key: "key-2", payload: { revision: 2 }, label: "latest input" }),
    );
    return { accepted, waitingCount: ledger.waitingCount(), records: ledger.records() };
  })
  .extend("followUpBehindRunning", () => {
    const ledger = createJobLedger();
    ledger.put(runningRecord());
    const desk = deskWith({ ledger });
    desk.enqueueFollowUp(intake({ key: "key-2", payload: { revision: 2 } }));
    desk.enqueueFollowUp(intake({ key: "key-3", payload: { revision: 3 } }));
    return ledger.records();
  })
  .extend("filteredFollowUp", () => {
    const ledger = createJobLedger();
    const desk = deskWith({ ledger, prFilter: { targetPrs: [9], excludedPrs: [] } });
    return desk.enqueueFollowUp(intake());
  });

describe("通常受付", () => {
  it("空きレーンへの受付は受理される", ({ freeLaneIntake }) => {
    expect(freeLaneIntake.accepted).toStrictEqual(true);
  });

  it("空きレーンへの受付は待機ジョブとして積まれる", ({ freeLaneIntake }) => {
    expect(freeLaneIntake.waitingCount).toStrictEqual(1);
  });

  it("同じキーの再受付は待機実行を問わず却下される", ({ duplicateKeyIntake }) => {
    expect(duplicateKeyIntake).toStrictEqual(false);
  });

  it("実行中レーンへの別キー受付は破棄される", ({ runningLaneIntake }) => {
    expect(runningLaneIntake).toStrictEqual(false);
  });

  it("待機中レーンへの受付は直列化を許さない型では破棄される", ({ waitingLaneIntake }) => {
    expect(waitingLaneIntake).toStrictEqual(false);
  });

  it("待機直列化を許す型は同レーンでも受理される", ({ serializedWaitingIntake }) => {
    expect(serializedWaitingIntake.accepted).toStrictEqual(true);
  });

  it("待機直列化を許す型は同レーンの待機に到着順で並ぶ", ({ serializedWaitingIntake }) => {
    expect(serializedWaitingIntake.waitingCount).toStrictEqual(2);
  });

  it("PR フィルタに落ちるレーンは受付時点で却下される", ({ filteredLaneIntake }) => {
    expect(filteredLaneIntake.accepted).toStrictEqual(false);
  });

  it("PR フィルタに落ちるレーンは記録も残さない", ({ filteredLaneIntake }) => {
    expect(filteredLaneIntake.records).toStrictEqual([]);
  });
});

describe("畳み込み受付", () => {
  it("同型同レーンの待機ジョブがあれば受理する", ({ coalescedIntake }) => {
    expect(coalescedIntake.accepted).toStrictEqual(true);
  });

  it("畳み込みは待機ジョブを増やさない", ({ coalescedIntake }) => {
    expect(coalescedIntake.waitingCount).toStrictEqual(1);
  });

  it("畳み込みはペイロードを結合する", ({ coalescedIntake }) => {
    expect(coalescedIntake.records[0]?.payload).toStrictEqual({
      merged: [{ revision: 1 }, { revision: 2 }],
    });
  });

  it("待機がなくレーンが実行中なら破棄する", ({ coalesceOnRunningLane }) => {
    expect(coalesceOnRunningLane).toStrictEqual(false);
  });

  it("レーンが空いていれば受理される", ({ coalesceOnFreeLane }) => {
    expect(coalesceOnFreeLane.accepted).toStrictEqual(true);
  });

  it("レーンが空いていれば新規待機ジョブとして積む", ({ coalesceOnFreeLane }) => {
    expect(coalesceOnFreeLane.waitingCount).toStrictEqual(1);
  });
});

describe("後続受付", () => {
  it("同型同レーンの待機ジョブへの後続は受理される", ({ followUpReplacement }) => {
    expect(followUpReplacement.accepted).toStrictEqual(true);
  });

  it("後続の差し替えは待機ジョブを増やさない", ({ followUpReplacement }) => {
    expect(followUpReplacement.waitingCount).toStrictEqual(1);
  });

  it("後続の差し替えは元の ID を保つ", ({ followUpReplacement }) => {
    expect(followUpReplacement.records[0]?.id).toStrictEqual("job-1");
  });

  it("後続の差し替えは内容ごと最新になる", ({ followUpReplacement }) => {
    expect(followUpReplacement.records[0]?.payload).toStrictEqual({ revision: 2 });
  });

  it("後続の差し替えはキーも最新になる", ({ followUpReplacement }) => {
    expect(followUpReplacement.records[0]?.key).toStrictEqual("key-2");
  });

  it("レーンが実行中でも後続は破棄されない", ({ followUpBehindRunning }) => {
    expect(followUpBehindRunning.length).toStrictEqual(2);
  });

  it("実行中レーンの真後ろに並ぶのは待機 1 件だけになる", ({ followUpBehindRunning }) => {
    expect(followUpBehindRunning[1]?.state).toStrictEqual("waiting");
  });

  it("実行中レーンの真後ろの待機は最新の内容を持つ", ({ followUpBehindRunning }) => {
    expect(followUpBehindRunning[1]?.payload).toStrictEqual({ revision: 3 });
  });

  it("後続受付にも PR フィルタは適用される", ({ filteredFollowUp }) => {
    expect(filteredFollowUp).toStrictEqual(false);
  });
});
