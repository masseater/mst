import { ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runWithSlot } from "./run-command.ts";
import { runThrottle, type ThrottleSeams } from "./run-throttle.ts";
import { tryAcquireAny } from "./slots.ts";

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
  waitBudgetMs: 30_000,
  pollMs: 10_000,
  isInteractive: false,
});

class ImmediateChildProcess extends ChildProcess {
  override readonly pid = 314_159;
}

describe("run-command", () => {
  test("every outcome of the wrapped command releases the slot", { timeout: 60_000 }, async () => {
    const slotDir = temporaryDirectory("throttle-release-");
    const stderrText = captureStderr();
    const seams = quickSeams(slotDir);
    const probe = async (): Promise<void> => {
      const hold = await tryAcquireAny({ slotDir, limit: 1 });
      expect(hold).not.toBeNull();
      await hold?.release();
    };

    expect(await runThrottle(trivialCommand, seams)).toBe(0);
    await probe();

    expect(await runThrottle(["--", process.execPath, "-e", "process.exit(3);"], seams)).toBe(1);
    expect(stderrText()).toContain("failed with exit code 3");
    await probe();

    expect(
      await runThrottle(
        ["--", process.execPath, "-e", 'process.kill(process.pid, "SIGTERM");'],
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
        ["--timeout", "1", "--", process.execPath, "-e", "setTimeout(() => {}, 30_000);"],
        seams,
      ),
    ).toBe(1);
    expect(stderrText()).toContain("ran past the 1s timeout");
    expect(stderrText()).not.toContain("could not terminate the whole command tree");
    await probe();
  });

  test("a timeout that never fires does not delay a fast command", async () => {
    captureStderr();
    const child = new ImmediateChildProcess();
    const spawnChild = vi.fn<
      (input: { executable: string; args: readonly string[] }) => ChildProcess
    >(() => {
      queueMicrotask(() => child.emit("exit", 0, null));
      return child;
    });
    const release = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const signalTree = vi.fn<(input: { pid: number; signal: NodeJS.Signals }) => Error | null>(
      () => null,
    );

    expect(
      await runWithSlot({
        invocation: {
          timeoutSec: 30,
          executable: process.execPath,
          args: ["-e", ""],
          commandLine: `${process.execPath} -e `,
        },
        hold: { release },
        dependencies: { spawnChild, signalTree },
      }),
    ).toBe(0);
    expect(spawnChild).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
    expect(signalTree).not.toHaveBeenCalled();
  });

  test("a release failure makes a successful command fail observably", async () => {
    const stderrText = captureStderr();
    const releaseSlot = vi.fn<() => Promise<void>>(() =>
      Promise.reject(new Error("unlock failed")),
    );

    expect(
      await runWithSlot({
        invocation: {
          timeoutSec: 0,
          executable: process.execPath,
          args: ["-e", ""],
          commandLine: `${process.execPath} -e `,
        },
        hold: { release: releaseSlot },
      }),
    ).toBe(1);
    expect(releaseSlot).toHaveBeenCalledOnce();
    expect(stderrText()).toContain("could not release the slot: unlock failed");
  });

  test("a release failure is reported alongside a command failure", async () => {
    const stderrText = captureStderr();

    expect(
      await runWithSlot({
        invocation: {
          timeoutSec: 0,
          executable: process.execPath,
          args: ["-e", "process.exit(3);"],
          commandLine: `${process.execPath} -e process.exit(3);`,
        },
        hold: { release: () => Promise.reject(new Error("close failed")) },
      }),
    ).toBe(1);
    expect(stderrText()).toContain("command failed with exit code 3");
    expect(stderrText()).toContain("could not release the slot: close failed");
  });

  test("a non-error release failure is rendered on stderr", async () => {
    const stderrText = captureStderr();
    const release = (): Promise<void> => {
      const pending = Promise.withResolvers<undefined>();
      Reflect.apply(pending.reject, undefined, ["unlock failed"]);
      return pending.promise;
    };

    expect(
      await runWithSlot({
        invocation: {
          timeoutSec: 0,
          executable: process.execPath,
          args: ["-e", ""],
          commandLine: `${process.execPath} -e `,
        },
        hold: { release },
      }),
    ).toBe(1);
    expect(stderrText()).toContain("could not release the slot: unlock failed");
  });

  test("Windows timeout forcefully terminates the process tree without a POSIX grace period", async () => {
    const stderrText = captureStderr();
    const signalTree = vi.fn<(input: { pid: number; signal: NodeJS.Signals }) => Error | null>(
      (input) => {
        process.kill(input.pid, input.signal);
        return null;
      },
    );
    const before = Date.now();

    expect(
      await runWithSlot({
        invocation: {
          timeoutSec: 1,
          executable: process.execPath,
          args: ["-e", "setInterval(() => {}, 1000);"],
          commandLine: `${process.execPath} -e setInterval`,
        },
        hold: { release: async () => undefined },
        dependencies: { platform: "win32", signalTree },
      }),
    ).toBe(1);
    expect(Date.now() - before).toBeLessThan(10_000);
    expect(signalTree).toHaveBeenCalledTimes(1);
    expect(signalTree).toHaveBeenCalledWith(expect.objectContaining({ signal: "SIGKILL" }));
    expect(stderrText()).toContain("ran past the 1s timeout");
  });

  test("a process tree termination failure is visible even when the root is stopped", async () => {
    const stderrText = captureStderr();
    const terminationFailure = new Error("taskkill denied");

    expect(
      await runWithSlot({
        invocation: {
          timeoutSec: 1,
          executable: process.execPath,
          args: ["-e", "setInterval(() => {}, 1000);"],
          commandLine: `${process.execPath} -e setInterval`,
        },
        hold: { release: async () => undefined },
        dependencies: {
          platform: "win32",
          signalTree: (input) => {
            process.kill(input.pid, input.signal);
            return terminationFailure;
          },
        },
      }),
    ).toBe(1);
    expect(stderrText()).toContain("could not terminate the whole command tree: taskkill denied");
    expect(stderrText()).toContain("ran past the 1s timeout");
  });

  test(
    "the timeout escalates after the root exits while a grandchild survives SIGTERM",
    { timeout: 50_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-tree-");
      const stamps = temporaryDirectory("throttle-tree-stamps-");
      const pidFile = join(stamps, "grandchild-pid");
      const stderrText = captureStderr();
      const stubborn = `const { spawn } = require("node:child_process"); const { writeFileSync } = require("node:fs"); const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);"], { stdio: "ignore" }); writeFileSync(${JSON.stringify(pidFile)}, String(child.pid)); setInterval(() => {}, 1000);`;
      const before = Date.now();

      const code = await runThrottle(
        ["--timeout", "10", "--", process.execPath, "-e", stubborn],
        quickSeams(slotDir),
      );

      const elapsed = Date.now() - before;
      expect(code).toBe(1);
      expect(stderrText()).toContain("ran past the 10s timeout");
      expect(elapsed).toBeGreaterThan(14_500);
      await delay(200);
      const grandchild = Number(readFileSync(pidFile, "utf8").trim());
      expect(() => {
        process.kill(grandchild, 0);
      }).toThrow(/ESRCH/);
    },
  );
});
