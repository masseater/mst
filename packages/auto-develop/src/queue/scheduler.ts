import { ABORT_SIGNAL_EVENT } from "../runtime/event-names.ts";

import type { Logger } from "../logging/logger.ts";

const DEFAULT_RESTART_CHECK_INTERVAL_MS = 60_000;

const DEFAULT_CLEANUP_INTERVAL_MS = 30 * 60_000;

type PeriodicCleanup = {
  readonly run: () => Promise<void>;
  readonly intervalMs?: number;
};

export type PeriodicSchedule = {
  readonly checkRestart: () => void;
  readonly restartCheckIntervalMs?: number;
  readonly cleanup?: PeriodicCleanup;
  readonly log: Logger;
};

export type PeriodicScheduler = {
  readonly start: () => PeriodicScheduler;
  readonly stop: () => Promise<void>;
  readonly isRunning: () => boolean;
};

const nextCleanupRoundReached = (waiting: {
  readonly intervalMs: number;
  readonly halted: AbortSignal;
}): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const roundTimer = setTimeout(() => {
      resolve(true);
    }, waiting.intervalMs);
    waiting.halted.addEventListener(
      ABORT_SIGNAL_EVENT.abort,
      () => {
        clearTimeout(roundTimer);
        resolve(false);
      },
      { once: true },
    );
  });

const runCleanupRounds = async (rounds: {
  readonly cleanup: PeriodicCleanup;
  readonly log: Logger;
  readonly halted: AbortSignal;
}): Promise<void> => {
  const intervalMs = rounds.cleanup.intervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
  for (;;) {
    if (rounds.halted.aborted) return;
    const roundReached = await nextCleanupRoundReached({ intervalMs, halted: rounds.halted });
    if (!roundReached) return;
    try {
      await rounds.cleanup.run();
    } catch (cleanupFailure) {
      rounds.log.warn({ err: cleanupFailure }, "periodic cleanup failed");
    }
  }
};

const startedScheduler = (schedule: PeriodicSchedule): PeriodicScheduler => {
  const halt = new AbortController();
  const restartCheckTimer = setInterval(() => {
    schedule.checkRestart();
  }, schedule.restartCheckIntervalMs ?? DEFAULT_RESTART_CHECK_INTERVAL_MS);
  const cleanup = schedule.cleanup;
  const cleanupRounds =
    cleanup === undefined
      ? Promise.resolve()
      : runCleanupRounds({ cleanup, log: schedule.log, halted: halt.signal });
  const started: PeriodicScheduler = {
    start: () => started,
    stop: async () => {
      clearInterval(restartCheckTimer);
      halt.abort();
      await cleanupRounds;
    },
    isRunning: () => !halt.signal.aborted,
  };
  return started;
};

export const createPeriodicScheduler = (schedule: PeriodicSchedule): PeriodicScheduler => ({
  start: () => startedScheduler(schedule),
  stop: () => Promise.resolve(),
  isRunning: () => false,
});
