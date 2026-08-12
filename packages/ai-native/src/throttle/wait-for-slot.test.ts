import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runThrottle, type ThrottleSeams } from "./run-throttle.ts";
import { ensureSlots, sweepWaiters, tryAcquireAny, type SlotHold } from "./slots.ts";
import { waitForSlot, type WaitConfiguration } from "./wait-for-slot.ts";

const temporaryDirectory = (prefix: string): string => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  onTestFinished(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
};

const captureStderr = (): { joined: () => string; chunks: () => string[] } => {
  const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return {
    joined: () => spy.mock.calls.map(([chunk]) => String(chunk)).join(""),
    chunks: () => spy.mock.calls.map(([chunk]) => String(chunk)),
  };
};

class NoSuchProcessError extends Error {
  readonly code = "ESRCH";
}

const holdSlot = async (slotDir: string): Promise<() => Promise<void>> => {
  ensureSlots(slotDir, 1);
  const hold = await tryAcquireAny({ slotDir, limit: 1 });
  if (hold === null) throw new Error("expected to acquire the slot");
  return hold.release;
};

const released = new WeakSet<() => Promise<void>>();

const releaseOnce = async (release: () => Promise<void>): Promise<void> => {
  if (released.has(release)) return;
  released.add(release);
  await release();
};

const trivialCommand = ["--", process.execPath, "-e", ""];

const quickSeams = (slotDir: string): ThrottleSeams => ({
  slotDir,
  limit: 1,
  waitBudgetMs: 15_000,
  pollMs: 50,
  isInteractive: false,
});

const quickConfiguration = (slotDir: string): WaitConfiguration => ({
  slotDir,
  limit: 1,
  waitBudgetMs: 8000,
  pollMs: 50,
  interactive: false,
});

const acquiredSlot = (result: SlotHold | "budget-exhausted"): SlotHold => {
  expect(result).not.toBe("budget-exhausted");
  if (result === "budget-exhausted") throw new Error("expected a slot hold");
  return result;
};

const namedSlot = async (
  name: "A" | "B",
  pending: Promise<SlotHold | "budget-exhausted">,
): Promise<{ name: "A" | "B"; result: SlotHold | "budget-exhausted" }> => ({
  name,
  result: await pending,
});

const releaseResourcesAfterTest = (
  initialRelease: (() => Promise<void>) | undefined,
): {
  addPending: (pending: Promise<SlotHold | "budget-exhausted">) => void;
  releaseInitial: () => Promise<void>;
} => {
  const pendingSlots = new Set<Promise<SlotHold | "budget-exhausted">>();
  const releaseInitial = async (): Promise<void> => {
    if (initialRelease !== undefined) await releaseOnce(initialRelease);
  };
  onTestFinished(async () => {
    await releaseInitial();
    await Promise.all(
      [...pendingSlots].map(async (pending) => {
        const slot = await pending;
        if (slot !== "budget-exhausted") await releaseOnce(slot.release);
      }),
    );
  });
  return { addPending: (pending) => pendingSlots.add(pending), releaseInitial };
};

describe("wait-for-slot", () => {
  test("a live holder keeps its slot until release", { timeout: 30_000 }, async () => {
    const slotDir = temporaryDirectory("throttle-live-");
    const initialRelease = await holdSlot(slotDir);
    const resources = releaseResourcesAfterTest(initialRelease);
    const stderr = captureStderr();

    const pending = waitForSlot({
      ...quickConfiguration(slotDir),
      pollMs: 100,
    });
    resources.addPending(pending);
    const progressBeforeRelease = stderr.joined();
    await delay(300);
    const beforeRelease = await Promise.race([pending, delay(100, "still-waiting")]);
    await resources.releaseInitial();

    const hold = acquiredSlot(await pending);

    expect(progressBeforeRelease).toContain("waiting 1/1");
    expect(beforeRelease).toBe("still-waiting");
    await releaseOnce(hold.release);
  });

  test(
    "the wait queue holds exactly the live waiters and ranks close up",
    { timeout: 30_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-queue-");
      const initialRelease = await holdSlot(slotDir);
      const resources = releaseResourcesAfterTest(initialRelease);
      const stderr = captureStderr();
      const waiters = join(slotDir, "waiters");
      const configuration = quickConfiguration(slotDir);

      const pendingA = waitForSlot(configuration);
      resources.addPending(pendingA);
      const runA = namedSlot("A", pendingA);
      const afterA = readdirSync(waiters);
      const pendingB = waitForSlot(configuration);
      resources.addPending(pendingB);
      const runB = namedSlot("B", pendingB);
      const afterB = readdirSync(waiters);
      await vi.waitFor(() => {
        expect(stderr.joined()).toContain("waiting 2/2");
      }, 10_000);

      const deadEntry = "0000000000000-invalid-deadbeef";
      writeFileSync(join(waiters, deadEntry), "2147483647\n");
      const kill = vi.spyOn(process, "kill").mockImplementation((pid) => {
        if (pid === 2_147_483_647) throw new NoSuchProcessError("no such process");
        return true;
      });
      onTestFinished(() => {
        kill.mockRestore();
      });
      const afterSweep = sweepWaiters(slotDir);
      const deadPidWasChecked = kill.mock.calls.some(
        ([pid, signal]) => pid === 2_147_483_647 && signal === 0,
      );
      kill.mockRestore();

      const rankOneBeforeRelease = stderr
        .chunks()
        .filter((chunk) => chunk === "throttle: waiting 1/1\n").length;
      await resources.releaseInitial();
      const first = await Promise.race([runA, runB]);
      const afterFirst = readdirSync(waiters);
      await vi.waitFor(() => {
        const rankOneAfterRelease = stderr
          .chunks()
          .filter((chunk) => chunk === "throttle: waiting 1/1\n").length;
        expect(rankOneAfterRelease).toBeGreaterThan(rankOneBeforeRelease);
      }, 10_000);

      await releaseOnce(acquiredSlot(first.result).release);
      const second = await (first.name === "A" ? runB : runA);
      await releaseOnce(acquiredSlot(second.result).release);

      expect(afterA).toHaveLength(1);
      expect(afterB).toHaveLength(2);
      expect(afterSweep).toHaveLength(2);
      expect(afterSweep).not.toContain(deadEntry);
      expect(deadPidWasChecked).toBe(true);
      expect(afterFirst).toHaveLength(1);
      expect(readdirSync(waiters)).toHaveLength(0);
      expect(stderr.joined()).toContain("waiting 2/2");
      expect(stderr.joined()).toContain("waiting 1/1");
    },
  );

  test(
    "the wait budget bounds the wait and fails with the same words every time",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-budget-");
      const release = await holdSlot(slotDir);
      const stderr = captureStderr();
      const seams = { ...quickSeams(slotDir), pollMs: 100, waitBudgetMs: 400 };
      const before = Date.now();

      const first = await runThrottle(trivialCommand, seams);
      const elapsed = Date.now() - before;
      const second = await runThrottle(trivialCommand, seams);
      await release();

      expect(first).toBe(1);
      expect(second).toBe(1);
      expect(elapsed).toBeGreaterThanOrEqual(400);
      const failures = stderr.chunks().filter((chunk) => chunk.includes("gave up"));
      expect(failures).toHaveLength(2);
      expect(failures[0]).toBe(failures[1]);
      expect(failures[0]).toContain("400ms");
      expect(readdirSync(join(slotDir, "waiters"))).toHaveLength(0);
    },
  );

  test(
    "an interactive wait overwrites one line with the elapsed time and closes it",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-tty-");
      const release = await holdSlot(slotDir);
      const stderr = captureStderr();

      const pendingRun = runThrottle(trivialCommand, {
        ...quickSeams(slotDir),
        pollMs: 100,
        isInteractive: true,
      });
      await delay(350);
      await release();

      expect(await pendingRun).toBe(0);
      expect(stderr.joined()).toContain("\r");
      expect(stderr.joined()).toMatch(/waiting 1\/1 \d+s/);
      expect(stderr.chunks()).toContain("\n");
    },
  );

  test(
    "an interactive wait that runs out of budget still closes its line first",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-tty-budget-");
      const release = await holdSlot(slotDir);
      const stderr = captureStderr();

      const code = await runThrottle(trivialCommand, {
        ...quickSeams(slotDir),
        pollMs: 100,
        waitBudgetMs: 300,
        isInteractive: true,
      });
      await release();

      expect(code).toBe(1);
      expect(stderr.joined()).toContain("\r");
      expect(stderr.chunks()).toContain("\n");
      expect(stderr.joined()).toContain("gave up");
    },
  );

  test(
    "a non-interactive wait repeats nothing while the queue state stands still",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-plain-");
      const release = await holdSlot(slotDir);
      const stderr = captureStderr();

      const code = await runThrottle(trivialCommand, {
        ...quickSeams(slotDir),
        pollMs: 60,
        waitBudgetMs: 400,
      });
      await release();

      expect(code).toBe(1);
      expect(stderr.joined()).not.toContain("\r");
      expect(stderr.joined().split("throttle: waiting 1/1\n")).toHaveLength(2);
    },
  );
});
