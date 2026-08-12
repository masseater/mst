import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createPeriodicScheduler } from "./scheduler.ts";

const elapse = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms);
};

const it = test
  .extend("runningStates", () => {
    const scheduler = createPeriodicScheduler({
      checkRestart: vi.fn<() => void>(),
      cleanup: { run: () => Promise.resolve() },
      log: silentLogger,
    });
    const beforeStart = scheduler.isRunning();
    scheduler.start();
    const whileRunning = scheduler.isRunning();
    scheduler.stop();
    return { beforeStart, whileRunning, afterStop: scheduler.isRunning() };
  })
  .extend("restartCheckCounts", async () => {
    vi.useFakeTimers();
    const checkRestart = vi.fn<() => void>();
    const scheduler = createPeriodicScheduler({
      checkRestart,
      restartCheckIntervalMs: 10,
      log: silentLogger,
    });
    scheduler.start();
    scheduler.start();
    await elapse(35);
    scheduler.stop();
    const whileRunning = checkRestart.mock.calls.length;
    await elapse(25);
    const afterStop = checkRestart.mock.calls.length;
    vi.useRealTimers();
    return { whileRunning, afterStop };
  })
  .extend("cleanupStartCalls", async () => {
    const cleanupStarts = vi.fn<() => void>();
    const gate = new Map<string, () => void>();
    const scheduler = createPeriodicScheduler({
      checkRestart: vi.fn<() => void>(),
      restartCheckIntervalMs: 1000,
      cleanup: {
        run: () => {
          cleanupStarts();
          return new Promise<void>((resolve) => {
            gate.set("finish", resolve);
          });
        },
        intervalMs: 5,
      },
      log: silentLogger,
    });
    vi.useFakeTimers();
    scheduler.start();
    await elapse(30);
    scheduler.stop();
    gate.get("finish")?.();
    await elapse(5);
    vi.useRealTimers();
    return cleanupStarts.mock.calls;
  })
  .extend("cleanupFailureWarnCalls", async () => {
    const warnLog = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const scheduler = createPeriodicScheduler({
      checkRestart: vi.fn<() => void>(),
      restartCheckIntervalMs: 1000,
      cleanup: { run: () => Promise.reject(new Error("cleanup broke")), intervalMs: 10 },
      log: { info: () => undefined, warn: warnLog, error: () => undefined },
    });
    vi.useFakeTimers();
    scheduler.start();
    await elapse(25);
    scheduler.stop();
    vi.useRealTimers();
    return warnLog.mock.calls;
  })
  .extend("stopBeforeStartRunning", () => {
    const scheduler = createPeriodicScheduler({
      checkRestart: vi.fn<() => void>(),
      log: silentLogger,
    });
    scheduler.stop();
    return scheduler.isRunning();
  });

describe("createPeriodicScheduler", () => {
  it("開始前は非稼働である", ({ runningStates }) => {
    expect(runningStates.beforeStart).toStrictEqual(false);
  });

  it("開始後は稼働している", ({ runningStates }) => {
    expect(runningStates.whileRunning).toStrictEqual(true);
  });

  it("停止後は非稼働に戻る", ({ runningStates }) => {
    expect(runningStates.afterStop).toStrictEqual(false);
  });

  it("再起動チェックは間隔ごとに呼ばれる", ({ restartCheckCounts }) => {
    expect(restartCheckCounts.whileRunning).toBeGreaterThanOrEqual(2);
  });

  it("二重開始しても停止後に回数は増えない", ({ restartCheckCounts }) => {
    expect(restartCheckCounts.afterStop).toStrictEqual(restartCheckCounts.whileRunning);
  });

  it("掃除は前回分の実行中なら周期が来てもスキップされる", ({ cleanupStartCalls }) => {
    expect(cleanupStartCalls.length).toStrictEqual(1);
  });

  it("掃除の失敗は警告ログになりタイマーからは例外が漏れない", ({ cleanupFailureWarnCalls }) => {
    expect(cleanupFailureWarnCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("開始前の停止は例外を投げない", ({ stopBeforeStartRunning }) => {
    expect(stopBeforeStartRunning).toStrictEqual(false);
  });
});
