import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createPeriodicScheduler } from "./scheduler.ts";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("createPeriodicScheduler", () => {
  test("開始前は非稼働で開始後は稼働し停止後は非稼働に戻る", () => {
    const scheduler = createPeriodicScheduler({
      checkRestart: vi.fn<() => void>(),
      cleanup: { run: () => Promise.resolve() },
      log: silentLogger,
    });
    const beforeStart = scheduler.isRunning();
    scheduler.start();
    const whileRunning = scheduler.isRunning();
    scheduler.stop();
    expect([beforeStart, whileRunning, scheduler.isRunning()]).toStrictEqual([false, true, false]);
  });

  test("再起動チェックは間隔ごとに呼ばれ二重開始しても回数は増えない", async () => {
    const checkRestart = vi.fn<() => void>();
    const scheduler = createPeriodicScheduler({
      checkRestart,
      restartCheckIntervalMs: 10,
      log: silentLogger,
    });
    scheduler.start();
    scheduler.start();
    await sleep(35);
    scheduler.stop();
    const callsWhileRunning = checkRestart.mock.calls.length;
    await sleep(25);
    expect([callsWhileRunning >= 2, checkRestart.mock.calls.length]).toStrictEqual([
      true,
      callsWhileRunning,
    ]);
  });

  test("掃除は前回分の実行中なら周期が来てもスキップされる", async () => {
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
    scheduler.start();
    await sleep(30);
    scheduler.stop();
    gate.get("finish")?.();
    await sleep(5);
    expect(cleanupStarts.mock.calls.length).toStrictEqual(1);
  });

  test("掃除の失敗は警告ログになりタイマーからは例外が漏れない", async () => {
    const warnLog = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const scheduler = createPeriodicScheduler({
      checkRestart: vi.fn<() => void>(),
      restartCheckIntervalMs: 1000,
      cleanup: { run: () => Promise.reject(new Error("cleanup broke")), intervalMs: 10 },
      log: { info: () => undefined, warn: warnLog, error: () => undefined },
    });
    scheduler.start();
    await sleep(25);
    scheduler.stop();
    expect(warnLog.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  test("開始前の停止は例外を投げない", () => {
    const scheduler = createPeriodicScheduler({
      checkRestart: vi.fn<() => void>(),
      log: silentLogger,
    });
    scheduler.stop();
    expect(scheduler.isRunning()).toStrictEqual(false);
  });
});
