import type { Logger } from "../logging/logger.ts";

const DEFAULT_RESTART_CHECK_INTERVAL_MS = 60_000;

const DEFAULT_CLEANUP_INTERVAL_MS = 30 * 60_000;

export type PeriodicScheduler = {
  readonly start: () => void;
  readonly stop: () => void;
  readonly isRunning: () => boolean;
};

export const createPeriodicScheduler = (schedule: {
  readonly checkRestart: () => void;
  readonly restartCheckIntervalMs?: number;
  readonly cleanup?: {
    readonly run: () => Promise<void>;
    readonly intervalMs?: number;
  };
  readonly log: Logger;
}): PeriodicScheduler => {
  const timers = new Map<string, NodeJS.Timeout>();
  const flags = new Map<string, boolean>([["cleanupInFlight", false]]);

  const runCleanupGuarded = async (run: () => Promise<void>): Promise<void> => {
    if (flags.get("cleanupInFlight") === true) return;
    flags.set("cleanupInFlight", true);
    try {
      await run();
    } catch (cleanupFailure) {
      schedule.log.warn({ err: cleanupFailure }, "periodic cleanup failed");
    } finally {
      flags.set("cleanupInFlight", false);
    }
  };

  return {
    start: () => {
      if (timers.has("restartCheck")) return;
      timers.set(
        "restartCheck",
        setInterval(() => {
          schedule.checkRestart();
        }, schedule.restartCheckIntervalMs ?? DEFAULT_RESTART_CHECK_INTERVAL_MS),
      );
      const cleanup = schedule.cleanup;
      if (cleanup !== undefined) {
        timers.set(
          "cleanup",
          setInterval(
            () => void runCleanupGuarded(cleanup.run),
            cleanup.intervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS,
          ),
        );
      }
    },
    stop: () => {
      for (const timer of timers.values()) clearInterval(timer);
      timers.clear();
    },
    isRunning: () => timers.has("restartCheck"),
  };
};
