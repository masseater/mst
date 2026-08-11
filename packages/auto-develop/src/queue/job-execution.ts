import { carriesHaltDisposition } from "./halt-disposition.ts";

import type { Logger } from "../logging/logger.ts";
import type { JobLedger, JobRecord } from "./job-ledger.ts";

export type QueueSharedState = {
  readonly ledger: JobLedger;
  readonly flags: Map<string, boolean>;
  readonly reservedLanes: Set<string>;
  readonly drainWaiters: Set<() => void>;
  readonly handlerTable: Map<string, (payload: unknown) => Promise<void>>;
  readonly onHaltCell: Map<string, ((failure: unknown) => void) | undefined>;
};

export type JobExecution = {
  readonly pump: () => void;
  readonly isDrained: () => boolean;
  readonly notifyDrain: () => void;
};

const logSettled = (
  log: Logger,
  settling: { readonly record: JobRecord; readonly failure?: unknown },
): void => {
  if (settling.failure === undefined) {
    log.info({ lane: settling.record.lane, label: settling.record.label }, "job completed");
    return;
  }
  log.error({ label: settling.record.label, err: settling.failure }, "job failed; record consumed");
};

export const createJobExecution = (execution: {
  readonly state: QueueSharedState;
  readonly concurrency: number;
  readonly snapshotNow: () => void;
  readonly log: Logger;
}): JobExecution => {
  const { state, concurrency, snapshotNow, log } = execution;

  const isDrained = (): boolean =>
    state.ledger.runningCount() === 0 &&
    state.reservedLanes.size === 0 &&
    (state.ledger.waitingCount() === 0 || state.flags.get("halted") === true);

  const notifyDrain = (): void => {
    if (!isDrained()) return;
    for (const wake of state.drainWaiters) wake();
    state.drainWaiters.clear();
  };

  const haltWith = (halting: { readonly record: JobRecord; readonly failure: unknown }): void => {
    state.flags.set("halted", true);
    const running = state.ledger.get(halting.record.id);
    if (running !== undefined) state.ledger.put({ ...running, state: "waiting" });
    snapshotNow();
    log.error(
      {
        key: halting.record.key,
        lane: halting.record.lane,
        label: halting.record.label,
        err: halting.failure,
      },
      "queue halted permanently; job kept as waiting",
    );
    state.onHaltCell.get("cb")?.(halting.failure);
    notifyDrain();
  };

  const settleConsumed = (settling: {
    readonly record: JobRecord;
    readonly failure?: unknown;
  }): void => {
    if (state.ledger.remove(settling.record.id)) {
      logSettled(log, settling);
      snapshotNow();
      pump();
      notifyDrain();
      return;
    }
    snapshotNow();
    notifyDrain();
  };

  const settleFailure = (failing: {
    readonly record: JobRecord;
    readonly failure: unknown;
  }): void => {
    if (carriesHaltDisposition(failing.failure)) {
      haltWith(failing);
      return;
    }
    settleConsumed(failing);
  };

  const runJob = async (record: JobRecord): Promise<void> => {
    const handler = state.handlerTable.get(record.type);
    if (handler === undefined) {
      log.error(
        { key: record.key, type: record.type, label: record.label },
        "no job handler is registered for this type",
      );
      settleConsumed({ record });
      return;
    }
    try {
      await handler(record.payload);
      settleConsumed({ record });
    } catch (jobFailure) {
      settleFailure({ record, failure: jobFailure });
    }
  };

  const startJob = (record: JobRecord): void => {
    state.ledger.put({ ...record, state: "running" });
    snapshotNow();
    log.info({ lane: record.lane, label: record.label }, "job started");
    void runJob(record);
  };

  const pump = (): void => {
    if (state.flags.get("halted") === true) return;
    for (;;) {
      if (state.ledger.runningCount() >= concurrency) return;
      const nextJob = state.ledger
        .records()
        .find(
          (record) =>
            record.state === "waiting" &&
            !state.ledger.laneRunning(record.lane) &&
            !state.reservedLanes.has(record.lane),
        );
      if (nextJob === undefined) return;
      startJob(nextJob);
    }
  };

  return { pump, isDrained, notifyDrain };
};
