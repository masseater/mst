import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, test, vi } from "vite-plus/test";

import {
  INTERRUPT_SIGNALS,
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterruptHandler,
  makeRunningInterruptHandler,
  makeWaitingInterruptHandler,
  raiseSignal,
  safeKill,
} from "./signals.ts";

describe("signals", () => {
  test("the interrupt signals are the two polite termination requests", () => {
    expect(INTERRUPT_SIGNALS).toStrictEqual(["SIGINT", "SIGTERM"]);
  });

  test("install and drop register the same handler once per interrupt signal", () => {
    const handler = vi.fn<(signal: NodeJS.Signals) => void>();

    installInterruptHandler(handler);
    expect(process.listeners("SIGINT")).toContain(handler);
    expect(process.listeners("SIGTERM")).toContain(handler);

    dropInterruptHandler(handler);
    expect(process.listeners("SIGINT")).not.toContain(handler);
    expect(process.listeners("SIGTERM")).not.toContain(handler);
  });

  test("the waiting handler removes its own queue entry before re-raising", () => {
    const removeEntry = vi.fn<(entryPath: string) => void>();
    const raise = vi.fn<(signal: NodeJS.Signals) => void>();
    const handler = makeWaitingInterruptHandler({ entryPath: "/queue/entry", removeEntry, raise });

    handler("SIGTERM");

    expect(removeEntry).toHaveBeenCalledWith("/queue/entry");
    expect(raise).toHaveBeenCalledWith("SIGTERM");
    expect(removeEntry.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      raise.mock.invocationCallOrder[0] ?? 0,
    );
  });

  test("the held handler releases the slot and then re-raises", async () => {
    const release = vi.fn<() => Promise<void>>(async () => undefined);
    const raise = vi.fn<(signal: NodeJS.Signals) => void>();
    const handler = makeHeldInterruptHandler({ release, raise });

    handler("SIGINT");
    await delay(20);

    expect(release).toHaveBeenCalledTimes(1);
    expect(raise).toHaveBeenCalledWith("SIGINT");
  });

  test("the held handler still re-raises when the release fails", async () => {
    const release = vi.fn<() => Promise<void>>(async () => {
      throw new Error("lease already reclaimed");
    });
    const raise = vi.fn<(signal: NodeJS.Signals) => void>();
    const handler = makeHeldInterruptHandler({ release, raise });

    handler("SIGTERM");
    await delay(20);

    expect(raise).toHaveBeenCalledWith("SIGTERM");
  });

  test("the running handler forwards the signal to the child's process group", () => {
    const kill = vi.fn<(pid: number, signal: NodeJS.Signals) => boolean>(() => true);
    const handler = makeRunningInterruptHandler({ childPid: 4321, kill });

    handler("SIGINT");

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
