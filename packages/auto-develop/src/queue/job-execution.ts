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
  readonly settleStartedJobs: () => Promise<void>;
};

class TrackedStartedJobs {
  #settling: readonly Promise<void>[] = [];

  track(settlingJob: Promise<void>): void {
    this.#settling = [...this.#settling, settlingJob];
  }

  async settleAll(): Promise<void> {
    const settlingJobs = this.#settling;
    this.#settling = [];
    await Promise.all(settlingJobs);
  }
}

const createStartedJobs = (): {
  readonly track: (settlingJob: Promise<void>) => void;
  readonly settleAll: () => Promise<void>;
} => new TrackedStartedJobs();

const logSettled = (
  log: Logger,
  settling: { readonly record: JobRecord; readonly failure?: unknown },
): void => {
  if (settling.failure === undefined) {
    log.info({ lane: settling.record.lane, label: settling.record.label }, "job completed");
    return;
  }
  log.error(
    { label: settling.record.label, err: settling.failure },
    "job failed; written consumed",
  );
};

const createJobStarter = (starting: {
  readonly state: QueueSharedState;
  readonly snapshotNow: () => void;
  readonly log: Logger;
  readonly settleConsumed: (settling: { readonly record: JobRecord }) => void;
  readonly settleFailure: (failing: {
    readonly record: JobRecord;
    readonly failure: unknown;
  }) => void;
}): {
  readonly startJob: (written: JobRecord) => void;
  readonly settleStartedJobs: () => Promise<void>;
} => {
  const { state, snapshotNow, log } = starting;
  const startedJobs = createStartedJobs();

  const runJob = async (written: JobRecord): Promise<void> => {
    const takenHandler = state.handlerTable.get(written.type);
    if (takenHandler === undefined) {
      log.error(
        { key: written.key, type: written.type, label: written.label },
        "no job takenHandler is registered for this type",
      );
      starting.settleConsumed({ record: written });
      return;
    }
    try {
      await takenHandler(written.payload);
      starting.settleConsumed({ record: written });
    } catch (jobFailure) {
      starting.settleFailure({ record: written, failure: jobFailure });
    }
  };

  const startJob = (written: JobRecord): void => {
    state.ledger.put({ ...written, state: "running" });
    snapshotNow();
    log.info({ lane: written.lane, label: written.label }, "job started");
    const settlingJob = runJob(written);
    startedJobs.track(settlingJob);
  };

  return { startJob, settleStartedJobs: () => startedJobs.settleAll() };
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

  const starter = createJobStarter({ state, snapshotNow, log, settleConsumed, settleFailure });

  const pump = (): void => {
    if (state.flags.get("halted") === true) return;
    for (;;) {
      if (state.ledger.runningCount() >= concurrency) return;
      const nextJob = state.ledger
        .records()
        .find(
          (written) =>
            written.state === "waiting" &&
            !state.ledger.laneRunning(written.lane) &&
            !state.reservedLanes.has(written.lane),
        );
      if (nextJob === undefined) return;
      starter.startJob(nextJob);
    }
  };

  return {
    pump,
    isDrained,
    notifyDrain,
    settleStartedJobs: starter.settleStartedJobs,
  };
};
