import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createJobExecution } from "./job-execution.ts";
import { createJobIntakeDesk } from "./job-intake.ts";
import { createJobLedger } from "./job-ledger.ts";

describe("通常受付", () => {
  const it = test
    .extend("freeLaneAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("freeLaneWaitingCount", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.waitingCount();
    })
    .extend("duplicateKeyAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-8",
        label: "pr-events for PR #7",
      });
    })
    .extend("runningLaneAccepted", () => {
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
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("waitingLaneAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("serializedWaitingAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: ["pr-events"],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("serializedWaitingCount", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: ["pr-events"],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.waitingCount();
    })
    .extend("filteredLaneAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: { targetPrs: [], excludedPrs: [7] },
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("filteredLaneRecords", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: { targetPrs: [], excludedPrs: [7] },
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.records();
    });

  it("空きレーンへの受付は受理される", ({ freeLaneAccepted }) => {
    expect(freeLaneAccepted).toStrictEqual(true);
  });

  it("空きレーンへの受付は待機ジョブとして積まれる", ({ freeLaneWaitingCount }) => {
    expect(freeLaneWaitingCount).toStrictEqual(1);
  });

  it("同じキーの再受付は待機実行を問わず却下される", ({ duplicateKeyAccepted }) => {
    expect(duplicateKeyAccepted).toStrictEqual(false);
  });

  it("実行中レーンへの別キー受付は破棄される", ({ runningLaneAccepted }) => {
    expect(runningLaneAccepted).toStrictEqual(false);
  });

  it("待機中レーンへの受付は直列化を許さない型では破棄される", ({ waitingLaneAccepted }) => {
    expect(waitingLaneAccepted).toStrictEqual(false);
  });

  it("待機直列化を許す型は同レーンでも受理される", ({ serializedWaitingAccepted }) => {
    expect(serializedWaitingAccepted).toStrictEqual(true);
  });

  it("待機直列化を許す型は同レーンの待機に到着順で並ぶ", ({ serializedWaitingCount }) => {
    expect(serializedWaitingCount).toStrictEqual(2);
  });

  it("PR フィルタに落ちるレーンは受付時点で却下される", ({ filteredLaneAccepted }) => {
    expect(filteredLaneAccepted).toStrictEqual(false);
  });

  it("PR フィルタに落ちるレーンは記録も残さない", ({ filteredLaneRecords }) => {
    expect(filteredLaneRecords).toStrictEqual([]);
  });
});

describe("畳み込み受付", () => {
  const it = test
    .extend("coalescedAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {
          "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
            merged: [existingPayload, incomingPayload],
          }),
        },
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("coalescedWaitingCount", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {
          "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
            merged: [existingPayload, incomingPayload],
          }),
        },
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.waitingCount();
    })
    .extend("coalescedWaitingJob", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {
          "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
            merged: [existingPayload, incomingPayload],
          }),
        },
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.findWaiting({ type: "pr-events", lane: "pr-7" });
    })
    .extend("coalesceOnRunningLaneAccepted", () => {
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
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {
          "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
            merged: [existingPayload, incomingPayload],
          }),
        },
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("coalesceOnFreeLaneAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {
          "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
            merged: [existingPayload, incomingPayload],
          }),
        },
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      return desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    })
    .extend("coalesceOnFreeLaneWaitingCount", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {
          "pr-events": (existingPayload: unknown, incomingPayload: unknown): unknown => ({
            merged: [existingPayload, incomingPayload],
          }),
        },
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.waitingCount();
    });

  it("同型同レーンの待機ジョブがあれば受理する", ({ coalescedAccepted }) => {
    expect(coalescedAccepted).toStrictEqual(true);
  });

  it("畳み込みは待機ジョブを増やさない", ({ coalescedWaitingCount }) => {
    expect(coalescedWaitingCount).toStrictEqual(1);
  });

  it("畳み込みはペイロードを結合する", ({ coalescedWaitingJob }) => {
    expect(coalescedWaitingJob).toStrictEqual({
      id: "job-1",
      type: "pr-events",
      payload: { merged: [{ revision: 1 }, { revision: 2 }] },
      key: "key-1",
      lane: "pr-7",
      label: "pr-events for PR #7",
      state: "waiting",
      acceptedAt: "2026-08-11T00:00:00.000Z",
    });
  });

  it("待機がなくレーンが実行中なら破棄する", ({ coalesceOnRunningLaneAccepted }) => {
    expect(coalesceOnRunningLaneAccepted).toStrictEqual(false);
  });

  it("レーンが空いていれば受理される", ({ coalesceOnFreeLaneAccepted }) => {
    expect(coalesceOnFreeLaneAccepted).toStrictEqual(true);
  });

  it("レーンが空いていれば新規待機ジョブとして積む", ({ coalesceOnFreeLaneWaitingCount }) => {
    expect(coalesceOnFreeLaneWaitingCount).toStrictEqual(1);
  });
});

describe("後続受付", () => {
  const it = test
    .extend("followUpReplacementAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "latest input",
      });
    })
    .extend("followUpReplacementWaitingCount", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "latest input",
      });
      return ledger.waitingCount();
    })
    .extend("followUpReplacementKeptFirstId", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "latest input",
      });
      return ledger.has("job-1");
    })
    .extend("followUpReplacedJob", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "latest input",
      });
      return ledger.get("job-1");
    })
    .extend("followUpReplacementLatestKeyHeld", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueue({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "latest input",
      });
      return ledger.hasKey("key-2");
    })
    .extend("followUpBehindRunningRecords", () => {
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
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 3 },
        key: "key-3",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.records();
    })
    .extend("followUpBehindRunningWaitingCount", () => {
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
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 3 },
        key: "key-3",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.waitingCount();
    })
    .extend("followUpBehindRunningWaitingJob", () => {
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
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: undefined,
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 2 },
        key: "key-2",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 3 },
        key: "key-3",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
      return ledger.findWaiting({ type: "pr-events", lane: "pr-7" });
    })
    .extend("filteredFollowUpAccepted", () => {
      const ledger = createJobLedger();
      const desk = createJobIntakeDesk({
        ledger,
        execution: createJobExecution({
          state: {
            ledger,
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
        coalesce: {},
        waitingSerializedTypes: [],
        prFilter: { targetPrs: [9], excludedPrs: [] },
        nowIso: () => "2026-08-11T00:00:00.000Z",
        nextId: () => `job-${ledger.records().length + 1}`,
      });
      return desk.enqueueFollowUp({
        type: "pr-events",
        payload: { revision: 1 },
        key: "key-1",
        lane: "pr-7",
        label: "pr-events for PR #7",
      });
    });

  it("同型同レーンの待機ジョブへの後続は受理される", ({ followUpReplacementAccepted }) => {
    expect(followUpReplacementAccepted).toStrictEqual(true);
  });

  it("後続の差し替えは待機ジョブを増やさない", ({ followUpReplacementWaitingCount }) => {
    expect(followUpReplacementWaitingCount).toStrictEqual(1);
  });

  it("後続の差し替えは元の ID を保つ", ({ followUpReplacementKeptFirstId }) => {
    expect(followUpReplacementKeptFirstId).toStrictEqual(true);
  });

  it("後続の差し替えは内容ごと最新になる", ({ followUpReplacedJob }) => {
    expect(followUpReplacedJob).toStrictEqual({
      id: "job-1",
      type: "pr-events",
      payload: { revision: 2 },
      key: "key-2",
      lane: "pr-7",
      label: "latest input",
      state: "waiting",
      acceptedAt: "2026-08-11T00:00:00.000Z",
    });
  });

  it("後続の差し替えはキーも最新になる", ({ followUpReplacementLatestKeyHeld }) => {
    expect(followUpReplacementLatestKeyHeld).toStrictEqual(true);
  });

  it("レーンが実行中でも後続は破棄されない", ({ followUpBehindRunningRecords }) => {
    expect(followUpBehindRunningRecords).toStrictEqual([
      {
        id: "job-running",
        type: "pr-events",
        payload: {},
        key: "key-running",
        lane: "pr-7",
        label: "running",
        state: "running",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
      {
        id: "job-2",
        type: "pr-events",
        payload: { revision: 3 },
        key: "key-3",
        lane: "pr-7",
        label: "pr-events for PR #7",
        state: "waiting",
        acceptedAt: "2026-08-11T00:00:00.000Z",
      },
    ]);
  });

  it("実行中レーンの真後ろに並ぶのは待機 1 件だけになる", ({
    followUpBehindRunningWaitingCount,
  }) => {
    expect(followUpBehindRunningWaitingCount).toStrictEqual(1);
  });

  it("実行中レーンの真後ろの待機は最新の内容を持つ", ({ followUpBehindRunningWaitingJob }) => {
    expect(followUpBehindRunningWaitingJob).toStrictEqual({
      id: "job-2",
      type: "pr-events",
      payload: { revision: 3 },
      key: "key-3",
      lane: "pr-7",
      label: "pr-events for PR #7",
      state: "waiting",
      acceptedAt: "2026-08-11T00:00:00.000Z",
    });
  });

  it("後続受付にも PR フィルタは適用される", ({ filteredFollowUpAccepted }) => {
    expect(filteredFollowUpAccepted).toStrictEqual(false);
  });
});
