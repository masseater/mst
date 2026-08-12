import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runThrottle, type ThrottleSeams } from "./run-throttle.ts";

const temporaryDirectory = (prefix: string): string => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  onTestFinished(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
};

const captureStderr = (): (() => string) => {
  const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return () => spy.mock.calls.map(([writtenChunk]) => String(writtenChunk)).join("");
};

const trivialCommand = ["--", process.execPath, "-e", ""];

const quickSeams = (slotDir: string): ThrottleSeams => ({
  slotDir,
  limit: 1,
  staleMs: 5000,
  waitBudgetMs: 30_000,
  pollMs: 10_000,
  isInteractive: false,
});

describe("run-command", () => {
  test("every outcome of the wrapped command releases the slot", { timeout: 30_000 }, async () => {
    const slotDir = temporaryDirectory("throttle-release-");
    const stderrText = captureStderr();
    const seams = quickSeams(slotDir);
    const probe = async (): Promise<void> => {
      const before = Date.now();
      expect(await runThrottle(trivialCommand, seams)).toBe(0);
      expect(Date.now() - before).toBeLessThan(5000);
    };

    expect(await runThrottle(trivialCommand, seams)).toBe(0);
    await probe();

    expect(await runThrottle(["--", process.execPath, "-e", "process.exit(3);"], seams)).toBe(1);
    expect(stderrText()).toContain("failed with exit code 3");
    await probe();

    expect(
      await runThrottle(
        ["--", process.execPath, "-e", "process.kill(process.pid, 'SIGTERM');"],
        seams,
      ),
    ).toBe(1);
    expect(stderrText()).toContain("was killed by SIGTERM");
    await probe();

    expect(await runThrottle(["--", "/no/such/executable-for-throttle"], seams)).toBe(1);
    expect(stderrText()).toContain("could not start /no/such/executable-for-throttle");
    await probe();

    expect(
      await runThrottle(
        ["--timeout", "1", "--", process.execPath, "-e", "setTimeout(() => {}, 30000);"],
        seams,
      ),
    ).toBe(1);
    expect(stderrText()).toContain("ran past the 1s timeout");
    await probe();
  });

  test(
    "a timeout that never fires does not delay a fast command",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-fast-");
      captureStderr();
      const before = Date.now();

      expect(await runThrottle(["--timeout", "30", ...trivialCommand], quickSeams(slotDir))).toBe(
        0,
      );

      expect(Date.now() - before).toBeLessThan(5000);
    },
  );

  test(
    "the timeout kills the whole process tree, escalating to SIGKILL",
    { timeout: 25_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-tree-");
      const stamps = temporaryDirectory("throttle-tree-stamps-");
      const pidFile = join(stamps, "grandchild-pid");
      const stderrText = captureStderr();
      const stubborn = `trap "" TERM; sleep 30 & echo $! > "${pidFile}"; wait`;
      const before = Date.now();

      const code = await runThrottle(
        ["--timeout", "5", "--", "sh", "-c", stubborn],
        quickSeams(slotDir),
      );

      const elapsed = Date.now() - before;
      expect(code).toBe(1);
      expect(stderrText()).toContain("ran past the 5s timeout");
      expect(elapsed).toBeGreaterThan(9500);
      await delay(200);
      const grandchild = Number(readFileSync(pidFile, "utf8").trim());
      expect(() => {
        process.kill(grandchild, 0);
      }).toThrow(/ESRCH/);
    },
  );

  test(
    "a compromised lease is reported without touching the running command",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-compromise-");
      const stderrText = captureStderr();

      const pendingRun = runThrottle(
        ["--", process.execPath, "-e", "setTimeout(() => {}, 2600);"],
        {
          ...quickSeams(slotDir),
          staleMs: 2000,
        },
      );
      await delay(500);
      rmSync(join(slotDir, "slot-0.lock"), { recursive: true, force: true });

      expect(await pendingRun).toBe(0);
      expect(stderrText()).toContain("slot lease compromised");
    },
  );
});
