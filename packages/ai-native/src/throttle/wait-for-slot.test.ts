import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runThrottle, type ThrottleSeams } from "./run-throttle.ts";
import { ensureSlots, tryAcquireAny } from "./slots.ts";

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
    joined: () => spy.mock.calls.map(([writtenChunk]) => String(writtenChunk)).join(""),
    chunks: () => spy.mock.calls.map(([writtenChunk]) => String(writtenChunk)),
  };
};

const holdSlot = async (slotDir: string): Promise<() => Promise<void>> => {
  ensureSlots(slotDir, 1);
  const hold = await tryAcquireAny({ slotDir, limit: 1 });
  if (hold === null) throw new Error("expected to acquire the slot");
  return hold.release;
};

const trivialCommand = ["--", process.execPath, "-e", ""];

const EXITED_PID = 999_999_999;

const quickSeams = (slotDir: string): ThrottleSeams => ({
  slotDir,
  limit: 1,
  waitBudgetMs: 15_000,
  pollMs: 50,
  isInteractive: false,
});

describe("wait-for-slot", () => {
  test("a live holder keeps its slot until release", { timeout: 30_000 }, async () => {
    const slotDir = temporaryDirectory("throttle-live-");
    const release = await holdSlot(slotDir);
    captureStderr();
    const before = Date.now();

    const pendingRun = runThrottle(trivialCommand, {
      ...quickSeams(slotDir),
      pollMs: 100,
      waitBudgetMs: 10_000,
    });
    const [code] = await Promise.all([
      pendingRun,
      (async (): Promise<void> => {
        await delay(350);
        await release();
      })(),
    ]);

    const elapsed = Date.now() - before;
    expect(code).toBe(0);
    expect(elapsed).toBeGreaterThan(300);
    expect(elapsed).toBeLessThan(20_000);
  });

  test(
    "the wait queue holds exactly the live waiters and ranks close up",
    { timeout: 30_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-queue-");
      const release = await holdSlot(slotDir);
      const stderr = captureStderr();
      const waiters = join(slotDir, "waiters");
      const seams = { ...quickSeams(slotDir), pollMs: 60 };
      const shortSleep = ["--", process.execPath, "-e", "setTimeout(() => {}, 200);"];

      const runA = runThrottle(shortSleep, seams);
      await delay(150);
      const runB = runThrottle(shortSleep, seams);
      await delay(200);
      expect(readdirSync(waiters)).toHaveLength(2);

      writeFileSync(join(waiters, `0000000000000-${EXITED_PID}-deadbeef`), `${EXITED_PID}\n`);
      await delay(200);
      expect(readdirSync(waiters)).toHaveLength(2);

      await release();
      await delay(150);
      expect(readdirSync(waiters)).toHaveLength(1);

      expect(await runA).toBe(0);
      expect(await runB).toBe(0);
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
      expect(elapsed).toBeLessThan(1500);
      const failures = stderr.chunks().filter((writtenChunk) => writtenChunk.includes("gave up"));
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
