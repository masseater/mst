import { silentLogger, type Logger } from "../logging/logger.ts";
import { createJobExecution, type QueueSharedState } from "./job-execution.ts";
import { createJobIntakeDesk, type CoalesceTable, type JobIntake } from "./job-intake.ts";
import { createJobLedger } from "./job-ledger.ts";
import { laneAdmitted, type PrFilter } from "./pr-lane.ts";
import { createSnapshotWriter, resolveSnapshotPath } from "./snapshot.ts";

type JobHandlers = Readonly<Record<string, (payload: unknown) => Promise<void>>>;

export type JobQueueConfig = {
  readonly concurrency: number;
  readonly handlers?: JobHandlers;
  readonly coalesce?: CoalesceTable;
  readonly waitingSerializedTypes?: readonly string[];
  readonly snapshotPath?: string;
  readonly prFilter?: PrFilter;
  readonly onHalt?: (failure: unknown) => void;
  readonly log?: Logger;
  readonly env?: Readonly<Record<string, unknown>>;
  readonly nowIso?: () => string;
  readonly nextId?: () => string;
};

export type JobQueue = {
  readonly enqueue: (intake: JobIntake) => boolean;
  readonly enqueueFollowUp: (intake: JobIntake) => boolean;
  readonly setHandlers: (wiring: {
    readonly handlers: JobHandlers;
    readonly onHalt?: (failure: unknown) => void;
  }) => void;
  readonly runningLanes: () => readonly string[];
  readonly waitingLanes: () => readonly string[];
  readonly size: () => { readonly waiting: number; readonly running: number };
  readonly isIdle: () => boolean;
  readonly admitsLane: (lane: string) => boolean;
  readonly cancelLane: (lane: string) => number;
  readonly drain: () => Promise<void>;
  readonly reserveLane: <TaskResult>(
    lane: string,
    task: () => Promise<TaskResult>,
  ) => Promise<TaskResult | null>;
};

const moduleCounters = new Map([["nextJobId", 1]]);

const nextDefaultJobId = (): string => {
  const jobNumber = moduleCounters.get("nextJobId") as number;
  moduleCounters.set("nextJobId", jobNumber + 1);
  return `job-${jobNumber}`;
};

const sortedUniqueLanes = (lanes: readonly string[]): readonly string[] =>
  [...new Set(lanes)].toSorted();

export const createJobQueue = (config: JobQueueConfig): JobQueue => {
  if (!Number.isInteger(config.concurrency) || config.concurrency < 1) {
    throw new Error("concurrency must be a positive integer");
  }
  const log = config.log ?? silentLogger;
  const state: QueueSharedState = {
    ledger: createJobLedger(),
    flags: new Map([["halted", false]]),
    reservedLanes: new Set<string>(),
    drainWaiters: new Set<() => void>(),
    handlerTable: new Map(Object.entries(config.handlers ?? {})),
    onHaltCell: new Map([["cb", config.onHalt]]),
  };
  const snapshotWriter = createSnapshotWriter({
    snapshotPath: resolveSnapshotPath({
      explicitPath: config.snapshotPath,
      ...(config.env === undefined ? {} : { env: config.env }),
    }),
    log,
  });
  const snapshotNow = (): void => {
    snapshotWriter.write(state.ledger.records());
  };
  const execution = createJobExecution({
    state,
    concurrency: config.concurrency,
    snapshotNow,
    log,
  });
  const intakeDesk = createJobIntakeDesk({
    ledger: state.ledger,
    execution,
    snapshotNow,
    log,
    coalesce: config.coalesce ?? {},
    waitingSerializedTypes: config.waitingSerializedTypes ?? [],
    prFilter: config.prFilter,
    nowIso: config.nowIso ?? ((): string => new Date().toISOString()),
    nextId: config.nextId ?? nextDefaultJobId,
  });
  snapshotNow();
  return {
    enqueue: intakeDesk.enqueue,
    enqueueFollowUp: intakeDesk.enqueueFollowUp,
    setHandlers: (wiring) => {
      state.handlerTable.clear();
      for (const [jobType, handler] of Object.entries(wiring.handlers)) {
        state.handlerTable.set(jobType, handler);
      }
      state.onHaltCell.set("cb", wiring.onHalt);
    },
    runningLanes: () =>
      sortedUniqueLanes(
        state.ledger
          .records()
          .filter((record) => record.state === "running")
          .map((record) => record.lane),
      ),
    waitingLanes: () =>
      sortedUniqueLanes(
        state.ledger
          .records()
          .filter((record) => record.state === "waiting")
          .map((record) => record.lane),
      ),
    size: () => ({
      waiting: state.ledger.waitingCount(),
      running: state.ledger.runningCount(),
    }),
    isIdle: () => state.ledger.records().length === 0,
    admitsLane: (lane) => laneAdmitted({ lane, prFilter: config.prFilter }),
    cancelLane: (lane) => {
      const canceledRecords = state.ledger.records().filter((record) => record.lane === lane);
      for (const record of canceledRecords) state.ledger.remove(record.id);
      if (canceledRecords.length > 0) {
        snapshotNow();
        log.info({ lane, canceledCount: canceledRecords.length }, "lane canceled");
      }
      execution.notifyDrain();
      return canceledRecords.length;
    },
    drain: () => {
      execution.pump();
      if (execution.isDrained()) return Promise.resolve();
      return new Promise((resolve) => state.drainWaiters.add(resolve));
    },
    reserveLane: async (lane, task) => {
      const laneBusy =
        state.ledger.laneOccupied(lane) ||
        state.flags.get("halted") === true ||
        state.reservedLanes.has(lane);
      if (laneBusy) return null;
      state.reservedLanes.add(lane);
      try {
        return await task();
      } finally {
        state.reservedLanes.delete(lane);
        execution.pump();
        execution.notifyDrain();
      }
    },
  };
};
