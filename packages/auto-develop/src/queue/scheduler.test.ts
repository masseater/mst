import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createPeriodicScheduler } from "./scheduler.ts";

describe("createPeriodicScheduler", () => {
  const it = test
    .extend("runningBeforeStart", () => {
      const scheduler = createPeriodicScheduler({
        checkRestart: vi.fn<() => void>(),
        cleanup: { run: () => Promise.resolve() },
        log: silentLogger,
      });
      return scheduler.isRunning();
    })
    .extend("runningAfterStart", async () => {
      const scheduler = createPeriodicScheduler({
        checkRestart: vi.fn<() => void>(),
        cleanup: { run: () => Promise.resolve() },
        log: silentLogger,
      });
      const started = scheduler.start();
      const runningAfterStart = started.isRunning();
      await started.stop();
      return runningAfterStart;
    })
    .extend("runningAfterStop", async () => {
      const scheduler = createPeriodicScheduler({
        checkRestart: vi.fn<() => void>(),
        cleanup: { run: () => Promise.resolve() },
        log: silentLogger,
      });
      const started = scheduler.start();
      await started.stop();
      return started.isRunning();
    })
    .extend("runningAfterStopWithoutStart", async () => {
      const scheduler = createPeriodicScheduler({
        checkRestart: vi.fn<() => void>(),
        log: silentLogger,
      });
      await scheduler.stop();
      return scheduler.isRunning();
    })
    .extend("restartCheck", async () => {
      vi.useFakeTimers();
      const restartCheck = vi.fn<() => void>();
      const scheduler = createPeriodicScheduler({
        checkRestart: restartCheck,
        restartCheckIntervalMs: 10,
        log: silentLogger,
      });
      const started = scheduler.start();
      await vi.advanceTimersByTimeAsync(35);
      await started.stop();
      vi.useRealTimers();
      return restartCheck;
    })
    .extend("restartCheckAfterDoubleStartAndStop", async () => {
      vi.useFakeTimers();
      const restartCheckAfterDoubleStartAndStop = vi.fn<() => void>();
      const scheduler = createPeriodicScheduler({
        checkRestart: restartCheckAfterDoubleStartAndStop,
        restartCheckIntervalMs: 10,
        log: silentLogger,
      });
      const started = scheduler.start();
      const restarted = started.start();
      await vi.advanceTimersByTimeAsync(35);
      await restarted.stop();
      await vi.advanceTimersByTimeAsync(25);
      vi.useRealTimers();
      return restartCheckAfterDoubleStartAndStop;
    })
    .extend("cleanupRun", async () => {
      vi.useFakeTimers();
      const cleanupInFlight = Promise.withResolvers<undefined>();
      const cleanupRun = vi.fn<() => Promise<void>>(() => cleanupInFlight.promise);
      const scheduler = createPeriodicScheduler({
        checkRestart: vi.fn<() => void>(),
        restartCheckIntervalMs: 1000,
        cleanup: { run: cleanupRun, intervalMs: 5 },
        log: silentLogger,
      });
      const started = scheduler.start();
      await vi.advanceTimersByTimeAsync(30);
      cleanupInFlight.resolve(undefined);
      await started.stop();
      vi.useRealTimers();
      return cleanupRun;
    })
    .extend("cleanupFailureWarn", async () => {
      vi.useFakeTimers();
      const cleanupFailureWarn =
        vi.fn<(fields: Readonly<Record<string, unknown>>, sentence: string) => void>();
      const scheduler = createPeriodicScheduler({
        checkRestart: vi.fn<() => void>(),
        restartCheckIntervalMs: 1000,
        cleanup: { run: () => Promise.reject(new Error("cleanup broke")), intervalMs: 10 },
        log: { info: () => undefined, warn: cleanupFailureWarn, error: () => undefined },
      });
      const started = scheduler.start();
      await vi.advanceTimersByTimeAsync(25);
      await started.stop();
      vi.useRealTimers();
      return cleanupFailureWarn;
    });

  it("開始前は非稼働である", ({ runningBeforeStart }) => {
    expect(runningBeforeStart).toBe(false);
  });

  it("開始後は稼働している", ({ runningAfterStart }) => {
    expect(runningAfterStart).toBe(true);
  });

  it("停止後は非稼働に戻る", ({ runningAfterStop }) => {
    expect(runningAfterStop).toBe(false);
  });

  it("再起動チェックは間隔ごとに呼ばれる", ({ restartCheck }) => {
    expect(restartCheck).toHaveBeenCalledTimes(3);
  });

  it("二重開始しても停止後に回数は増えない", ({ restartCheckAfterDoubleStartAndStop }) => {
    expect(restartCheckAfterDoubleStartAndStop).toHaveBeenCalledTimes(3);
  });

  it("掃除は前回分の実行中なら周期が来てもスキップされる", ({ cleanupRun }) => {
    expect(cleanupRun).toHaveBeenCalledTimes(1);
  });

  it("掃除の失敗は警告ログになりタイマーからは例外が漏れない", ({ cleanupFailureWarn }) => {
    expect(cleanupFailureWarn).toHaveBeenCalledTimes(2);
  });

  it("開始前の停止は例外を投げない", ({ runningAfterStopWithoutStart }) => {
    expect(runningAfterStopWithoutStart).toBe(false);
  });
});
