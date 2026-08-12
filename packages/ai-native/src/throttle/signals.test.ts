import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, test, vi } from "vite-plus/test";

import {
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterruptHandler,
  makeRunningInterruptHandler,
  makeWaitingInterruptHandler,
  raiseSignal,
  safeKill,
} from "./signals.ts";

describe("signals", () => {
  test("install and drop register the same handler once per interrupt signal", () => {
    const takenHandler = vi.fn<(signal: NodeJS.Signals) => void>();

    installInterruptHandler(takenHandler);
    expect(process.listeners("SIGINT")).toContain(takenHandler);
    expect(process.listeners("SIGTERM")).toContain(takenHandler);

    dropInterruptHandler(takenHandler);
    expect(process.listeners("SIGINT")).not.toContain(takenHandler);
    expect(process.listeners("SIGTERM")).not.toContain(takenHandler);
  });

  test("the waiting handler removes its own queue entry before re-raising", () => {
    const removeEntry = vi.fn<(entryPath: string) => void>();
    const raise = vi.fn<(signal: NodeJS.Signals) => void>();
    const takenHandler = makeWaitingInterruptHandler({
      entryPath: "/queue/entry",
      removeEntry,
      raise,
    });

    takenHandler("SIGTERM");

    expect(removeEntry).toHaveBeenCalledWith("/queue/entry");
    expect(raise).toHaveBeenCalledWith("SIGTERM");
    expect(removeEntry.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      raise.mock.invocationCallOrder[0] ?? 0,
    );
  });

  test("the held handler releases the slot and then re-raises", async () => {
    const release = vi.fn<() => Promise<void>>(async () => undefined);
    const raise = vi.fn<(signal: NodeJS.Signals) => void>();
    const takenHandler = makeHeldInterruptHandler({ release, raise });

    takenHandler("SIGINT");
    await delay(20);

    expect(release).toHaveBeenCalledTimes(1);
    expect(raise).toHaveBeenCalledWith("SIGINT");
  });

  test("the held handler still re-raises when the release fails", async () => {
    const release = vi.fn<() => Promise<void>>(async () => {
      throw new Error("lease already reclaimed");
    });
    const raise = vi.fn<(signal: NodeJS.Signals) => void>();
    const takenHandler = makeHeldInterruptHandler({ release, raise });

    takenHandler("SIGTERM");
    await delay(20);

    expect(raise).toHaveBeenCalledWith("SIGTERM");
  });

  test("the running handler forwards the signal to the child's process group", () => {
    const kill = vi.fn<(pid: number, signal: NodeJS.Signals) => boolean>(() => true);
    const takenHandler = makeRunningInterruptHandler({ childPid: 4321, kill });

    takenHandler("SIGINT");

    expect(kill).toHaveBeenCalledWith(-4321, "SIGINT");
  });

  test("safeKill delivers a signal to a live process and swallows a miss on a dead one", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"]);
    const childDeath = new Promise<NodeJS.Signals | null>((resolve) => {
      child.once("exit", (_code, signal) => {
        resolve(signal);
      });
    });

    expect(safeKill(child.pid ?? 0, "SIGTERM")).toBe(true);

    expect(await childDeath).toBe("SIGTERM");
    expect(safeKill(child.pid ?? 0, "SIGTERM")).toBe(false);
  });

  test("raiseSignal sends the signal to the wrapper's own process", () => {
    expect(() => {
      raiseSignal("SIGWINCH");
    }).not.toThrow();
  });
});
