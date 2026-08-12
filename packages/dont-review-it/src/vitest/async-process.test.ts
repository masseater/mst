import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runAsyncProcess } from "./async-process.ts";

const FIXTURE_READY_TIMEOUT_MS = 20_000;
const RESISTANT_TREE_TIMEOUT_MS = 25_000;
const SUBPROCESS_TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 40_000;

const fixtureDirectory = (): string => {
  const root = mkdtempSync(join(tmpdir(), "dont-review-it-async-process-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  return root;
};

const processIdentifiersIn = (pidFile: string): readonly number[] =>
  readFileSync(pidFile, "utf8").trim().split("\n").map(Number);

const processIdentifiersWhenReady = async (pidFile: string): Promise<readonly number[]> => {
  await vi.waitFor(() => {
    expect(existsSync(pidFile)).toBe(true);
    expect(processIdentifiersIn(pidFile)).toHaveLength(2);
  }, FIXTURE_READY_TIMEOUT_MS);
  return processIdentifiersIn(pidFile);
};

const killFixtureGroup = (pidFile: string): void => {
  if (!existsSync(pidFile)) return;
  const [leaderPid] = processIdentifiersIn(pidFile);
  if (leaderPid === undefined) return;
  try {
    process.kill(-leaderPid, "SIGKILL");
  } catch (cleanupFailure) {
    if ((cleanupFailure as NodeJS.ErrnoException).code !== "ESRCH") throw cleanupFailure;
  }
};

describe("runAsyncProcess", () => {
  test("captures stdout, stderr, and the exit status", { timeout: TEST_TIMEOUT_MS }, async () => {
    const completedProcess = await runAsyncProcess({
      label: "observable child",
      command: process.execPath,
      arguments_: [
        "-e",
        'process.stdout.write("out"); process.stderr.write("err"); process.exit(7);',
      ],
      cwd: process.cwd(),
      timeoutMs: SUBPROCESS_TIMEOUT_MS,
    });

    expect(completedProcess).toStrictEqual({
      status: 7,
      signal: null,
      stdout: "out",
      stderr: "err",
    });
  });

  test("names a child that cannot be started", async () => {
    await expect(
      runAsyncProcess({
        label: "missing child",
        command: "/no/such/dont-review-it-test-executable",
        arguments_: [],
        cwd: process.cwd(),
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow(/missing child.*ENOENT/su);
  });

  test("refuses to start after its wall-clock budget is exhausted", async () => {
    await expect(
      runAsyncProcess({
        label: "expired child",
        command: process.execPath,
        arguments_: ["-e", ""],
        cwd: process.cwd(),
        timeoutMs: 0,
      }),
    ).rejects.toThrow(/expired child.*no wall-clock time remains/su);
  });

  test("Windows is refused before a child can be started", async () => {
    await expect(
      runAsyncProcess(
        {
          label: "Windows child",
          command: process.execPath,
          arguments_: [],
          cwd: process.cwd(),
          timeoutMs: 5_000,
        },
        { platform: "win32" },
      ),
    ).rejects.toThrow(/Windows child.*process-tree hard deadline cannot be guaranteed/su);
  });

  test(
    "a descendant is removed when its group leader exits successfully",
    { timeout: TEST_TIMEOUT_MS },
    async () => {
      const root = fixtureDirectory();
      const pidFile = join(root, "orphan-pid");
      onTestFinished(() => {
        killFixtureGroup(pidFile);
      });
      const program = [
        'const { spawn } = require("node:child_process");',
        'const { writeFileSync } = require("node:fs");',
        'const descendant = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });',
        "descendant.unref();",
        `writeFileSync(${JSON.stringify(pidFile)}, process.pid + "\\n" + descendant.pid + "\\n");`,
      ].join(" ");

      const completedProcess = await runAsyncProcess({
        label: "orphaning child",
        command: process.execPath,
        arguments_: ["-e", program],
        cwd: root,
        timeoutMs: SUBPROCESS_TIMEOUT_MS,
      });

      expect(completedProcess.status).toBe(0);
      for (const pid of processIdentifiersIn(pidFile)) {
        expect(() => {
          process.kill(pid, 0);
        }).toThrow(/ESRCH/u);
      }
    },
  );

  test(
    "kills a signal-resistant process group at the wall-clock deadline",
    { timeout: TEST_TIMEOUT_MS },
    async () => {
      const root = fixtureDirectory();
      const pidFile = join(root, "pids");
      onTestFinished(() => {
        killFixtureGroup(pidFile);
      });
      const program = [
        'const { spawn } = require("node:child_process");',
        'const { writeFileSync } = require("node:fs");',
        'process.on("SIGTERM", () => undefined);',
        String.raw`const descendant = spawn(process.execPath, ["-e", "process.on(\"SIGTERM\", () => undefined); setInterval(() => undefined, 1000)"]);`,
        `writeFileSync(${JSON.stringify(pidFile)}, process.pid + "\\n" + descendant.pid + "\\n");`,
        "setInterval(() => undefined, 1000);",
      ].join(" ");

      const [readyProcessIdentifiers] = await Promise.all([
        processIdentifiersWhenReady(pidFile),
        expect(
          runAsyncProcess({
            label: "resistant tree",
            command: process.execPath,
            arguments_: ["-e", program],
            cwd: root,
            timeoutMs: RESISTANT_TREE_TIMEOUT_MS,
          }),
        ).rejects.toThrow(/resistant tree.*SIGTERM followed by SIGKILL/su),
      ]);

      for (const pid of readyProcessIdentifiers) {
        expect(() => {
          process.kill(pid, 0);
        }).toThrow(/ESRCH/u);
      }
    },
  );
});
