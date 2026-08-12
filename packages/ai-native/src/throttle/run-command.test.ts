import { ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runWithSlot } from "./run-command.ts";
import { runThrottle, type ThrottleSeams } from "./run-throttle.ts";
import { safeKill } from "./signals.ts";
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
  return () => spy.mock.calls.map(([chunk]) => String(chunk)).join("");
};

const trivialCommand = ["--", process.execPath, "-e", ""];

const wrappedCommandCases = [
  {
    name: "success",
    argv: trivialCommand,
    exitCode: 0,
    diagnostic: "throttle: run",
  },
  {
    name: "nonzero exit",
    argv: ["--", process.execPath, "-e", "process.exit(3);"],
    exitCode: 1,
    diagnostic: "failed with exit code 3",
  },
  {
    name: "signal exit",
    argv: ["--", process.execPath, "-e", "process.kill(process.pid, 'SIGTERM');"],
    exitCode: 1,
    diagnostic: "was killed by SIGTERM",
  },
  {
    name: "start failure",
    argv: ["--", "/no/such/executable-for-throttle"],
    exitCode: 1,
    diagnostic: "could not start /no/such/executable-for-throttle",
  },
  {
    name: "timeout",
    argv: ["--timeout", "1", "--", process.execPath, "-e", "setTimeout(() => {}, 30000);"],
    exitCode: 1,
    diagnostic: "ran past the 1s timeout",
  },
] as const;

const quickSeams = (slotDir: string): ThrottleSeams => ({
  slotDir,
  limit: 1,
  waitBudgetMs: 30_000,
  pollMs: 10_000,
  isInteractive: false,
});

class SuccessfulChild extends ChildProcess {
  override readonly pid = 2_147_483_647;
}

const successfulChild = (): ChildProcess => {
  const child = new SuccessfulChild();
  queueMicrotask(() => {
    child.emit("exit", 0, null);
  });
  return child;
};

describe("run-command", () => {
  test.each(wrappedCommandCases)(
    "releases the slot after the wrapped command ends with $name",
    { timeout: 15_000 },
    async (wrappedCommandCase) => {
      const slotDir = temporaryDirectory("throttle-release-");
      const stderrText = captureStderr();

      expect(await runThrottle(wrappedCommandCase.argv, quickSeams(slotDir))).toBe(
        wrappedCommandCase.exitCode,
      );
      const released = await tryAcquireAny({ slotDir, limit: 1 });
      expect(released).not.toBeNull();
      await released?.release();
      expect(stderrText()).toContain(wrappedCommandCase.diagnostic);
    },
  );

  test(
    "a timeout that never fires does not delay a fast command",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-fast-");
      captureStderr();

      expect(await runThrottle(["--timeout", "30", ...trivialCommand], quickSeams(slotDir))).toBe(
        0,
      );
    },
  );

  test.each(["SIGINT", "SIGTERM"] as const)(
    "forwards repeated %s signals while the command is running",
    { timeout: 60_000 },
    async (interruptSignal) => {
      const root = mkdtempSync(join(tmpdir(), "throttle-repeated-signal-"));
      const childPidFile = join(root, "child-pid");
      const wrappedProgram = `
        const { writeFileSync, writeSync } = require("node:fs");
        let received = 0;
        process.on(${JSON.stringify(interruptSignal)}, () => {
          writeSync(1, ${JSON.stringify(`${interruptSignal}\n`)});
          received += 1;
          if (received === 2) process.exit(0);
        });
        writeFileSync(${JSON.stringify(childPidFile)}, String(process.pid));
        writeSync(1, \`ready \${process.pid}\\n\`);
        setInterval(() => {}, 1000);
      `;
      const wrapper = spawn(
        process.execPath,
        [
          fileURLToPath(new URL("./cli.ts", import.meta.url)),
          "--",
          process.execPath,
          "-e",
          wrappedProgram,
        ],
        {
          env: { ...process.env, TMPDIR: root },
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
      const outputLines = createInterface({ input: wrapper.stdout });
      const output = outputLines[Symbol.asyncIterator]();
      onTestFinished(() => {
        outputLines.close();
        if (existsSync(childPidFile)) {
          safeKill(-Number(readFileSync(childPidFile, "utf8")), "SIGKILL");
        }
        if (wrapper.pid !== undefined) safeKill(wrapper.pid, "SIGKILL");
        rmSync(root, { recursive: true, force: true });
      });
      const wrapperEnd = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          wrapper.once("exit", (exitCode, signal) => {
            resolve({ exitCode, signal });
          });
        },
      );

      const ready = await output.next();
      if (ready.done === true) throw new Error("throttle command ended before it became ready");
      expect(ready.value).toMatch(/^ready \d+$/);
      const recordedChildPid = Number(ready.value.slice("ready ".length));
      if (wrapper.pid === undefined) throw new Error("throttle wrapper did not start");

      process.kill(wrapper.pid, interruptSignal);
      expect(await output.next()).toStrictEqual({ value: interruptSignal, done: false });
      expect(() => {
        process.kill(wrapper.pid ?? 0, 0);
      }).not.toThrow();

      process.kill(wrapper.pid, interruptSignal);

      expect(await wrapperEnd).toStrictEqual({ exitCode: 0, signal: null });
      expect(await output.next()).toStrictEqual({ value: interruptSignal, done: false });
      expect(await output.next()).toStrictEqual({ value: undefined, done: true });
      expect(() => {
        process.kill(recordedChildPid, 0);
      }).toThrow(/ESRCH/);
    },
  );

  test("a failed slot release is reported and makes a successful command fail", async () => {
    const stderrText = captureStderr();
    const release = vi.fn<() => Promise<void>>(async () => {
      throw new Error("lease directory became unreadable");
    });

    const exitCode = await runWithSlot({
      invocation: {
        timeoutSec: 0,
        executable: process.execPath,
        args: ["-e", ""],
        commandLine: `${process.execPath} -e `,
      },
      hold: { release },
      spawnCommand: successfulChild,
    });

    expect(exitCode).toBe(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(stderrText()).toContain(
      "throttle: could not release the slot: lease directory became unreadable",
    );
  });

  test("a non-error slot release failure is rendered and fails the wrapper", async () => {
    const stderrText = captureStderr();
    const release = vi.fn<() => Promise<void>>().mockRejectedValue("lease directory disappeared");

    const exitCode = await runWithSlot({
      invocation: {
        timeoutSec: 0,
        executable: process.execPath,
        args: ["-e", ""],
        commandLine: `${process.execPath} -e `,
      },
      hold: { release },
      spawnCommand: successfulChild,
    });

    expect(exitCode).toBe(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(stderrText()).toContain(
      "throttle: could not release the slot: lease directory disappeared",
    );
  });

  test(
    "the timeout kills the whole process tree, escalating to SIGKILL",
    { timeout: 45_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-tree-");
      const stamps = temporaryDirectory("throttle-tree-stamps-");
      const leaderPidFile = join(stamps, "leader-pid");
      const pidFile = join(stamps, "grandchild-pid");
      const termFile = join(stamps, "term-received");
      const stderrText = captureStderr();
      const stubborn = [
        'const { spawn } = require("node:child_process");',
        'const { writeFileSync } = require("node:fs");',
        `writeFileSync(${JSON.stringify(leaderPidFile)}, String(process.pid));`,
        `process.on("SIGTERM", () => writeFileSync(${JSON.stringify(termFile)}, "SIGTERM\\n"));`,
        'const grandchild = spawn("sh", ["-c", "trap \\\"\\\" TERM; while :; do sleep 1; done"]);',
        `writeFileSync(${JSON.stringify(pidFile)}, String(grandchild.pid));`,
        "setInterval(() => {}, 1000);",
      ].join(" ");

      const pendingCode = runThrottle(
        ["--timeout", "5", "--", process.execPath, "-e", stubborn],
        quickSeams(slotDir),
      );
      onTestFinished(() => {
        if (!existsSync(leaderPidFile)) return;
        const leaderPid = Number(readFileSync(leaderPidFile, "utf8").trim());
        if (Number.isInteger(leaderPid) && leaderPid > 0) safeKill(-leaderPid, "SIGKILL");
      });
      const code = await pendingCode;

      expect(code).toBe(1);
      expect(stderrText()).toContain("ran past the 5s timeout");
      expect(readFileSync(termFile, "utf8")).toBe("SIGTERM\n");
      const grandchild = Number(readFileSync(pidFile, "utf8").trim());
      expect(() => {
        process.kill(grandchild, 0);
      }).toThrow(/ESRCH/);
    },
  );
});
