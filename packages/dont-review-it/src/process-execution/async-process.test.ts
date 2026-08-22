import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runAsyncProcess } from "@mst/dont-review-it/vitest";
import { attemptAsync } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

const FIXTURE_READY_TIMEOUT_MS = 10_000;

const RESISTANT_TREE_TIMEOUT_MS = 2_000;

const SUBPROCESS_TIMEOUT_MS = 30_000;

const TEST_TIMEOUT_MS = 40_000;

describe("runAsyncProcess", () => {
  describe("an observable child", () => {
    const it = test.extend("completedProcess", async () =>
      runAsyncProcess({
        label: "observable child",
        command: process.execPath,
        arguments_: [
          "-e",
          'process.stdout.write("out"); process.stderr.write("err"); process.exit(7);',
        ],
        cwd: process.cwd(),
        timeoutMs: SUBPROCESS_TIMEOUT_MS,
      }));

    it(
      "captures both streams and the process ending",
      { timeout: TEST_TIMEOUT_MS },
      ({ completedProcess }) => {
        expect(completedProcess).toStrictEqual({
          status: 7,
          signal: null,
          stdout: "out",
          stderr: "err",
        });
      },
    );
  });

  describe("a child that cannot be started", () => {
    const it = test.extend("missingChildIsNamed", async () => {
      const [processFailure] = await attemptAsync<unknown, Error>(() =>
        runAsyncProcess({
          label: "missing child",
          command: "/no/such/dont-review-it-test-executable",
          arguments_: [],
          cwd: process.cwd(),
          timeoutMs: 5_000,
        }),
      );
      if (processFailure === null) throw new Error("the missing child unexpectedly started");
      return (
        processFailure.message.includes("missing child") &&
        processFailure.message.includes("ENOENT")
      );
    });

    it("names the child and operating-system failure", ({ missingChildIsNamed }) => {
      expect(missingChildIsNamed).toBe(true);
    });
  });

  describe("an exhausted wall-clock budget", () => {
    const it = test.extend("expiredChildFailure", async () => {
      const [processFailure] = await attemptAsync<unknown, Error>(() =>
        runAsyncProcess({
          label: "expired child",
          command: process.execPath,
          arguments_: ["-e", ""],
          cwd: process.cwd(),
          timeoutMs: 0,
        }),
      );
      if (processFailure === null) throw new Error("the expired child unexpectedly started");
      return processFailure;
    });

    it("refuses to start the child", ({ expiredChildFailure }) => {
      expect(expiredChildFailure).toStrictEqual(
        new Error("expired child: no wall-clock time remains to start the subprocess"),
      );
    });
  });

  describe("a Windows process tree", () => {
    const it = test.extend("windowsChildFailure", async () => {
      const [processFailure] = await attemptAsync<unknown, Error>(() =>
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
      );
      if (processFailure === null) throw new Error("the Windows child unexpectedly started");
      return processFailure;
    });

    it("refuses a deadline it cannot guarantee", ({ windowsChildFailure }) => {
      expect(windowsChildFailure).toStrictEqual(
        new Error(
          "Windows child: Windows test subprocesses are refused because a process-tree hard deadline cannot be guaranteed",
        ),
      );
    });
  });

  describe("a descendant whose group leader exits successfully", () => {
    const it = test.extend("processTreeWasRemoved", async ({}, { onCleanup }) => {
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-async-process-"));
      const pidFile = join(fixtureRoot, "orphan-pid");
      onCleanup(() => {
        try {
          if (!existsSync(pidFile)) return;
          const [leaderPid] = JSON.parse(readFileSync(pidFile, "utf8")) as readonly number[];
          if (leaderPid === undefined) return;
          try {
            process.kill(-leaderPid, "SIGKILL");
          } catch (cleanupFailure) {
            if ((cleanupFailure as NodeJS.ErrnoException).code !== "ESRCH") throw cleanupFailure;
          }
        } finally {
          rmSync(fixtureRoot, { recursive: true, force: true });
        }
      });
      const program = [
        'const { spawn } = require("node:child_process");',
        'const { writeFileSync } = require("node:fs");',
        'const descendant = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], { stdio: "ignore" });',
        "descendant.unref();",
        `writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify([process.pid, descendant.pid]));`,
      ].join(" ");

      await runAsyncProcess({
        label: "orphaning child",
        command: process.execPath,
        arguments_: ["-e", program],
        cwd: fixtureRoot,
        timeoutMs: SUBPROCESS_TIMEOUT_MS,
      });

      const processIdentifiers = JSON.parse(readFileSync(pidFile, "utf8")) as readonly number[];
      return processIdentifiers.every((processIdentifier) => {
        try {
          process.kill(processIdentifier, 0);
          return false;
        } catch (processLookupFailure) {
          return (processLookupFailure as NodeJS.ErrnoException).code === "ESRCH";
        }
      });
    });

    it(
      "removes the complete process group",
      { timeout: TEST_TIMEOUT_MS },
      ({ processTreeWasRemoved }) => {
        expect(processTreeWasRemoved).toBe(true);
      },
    );
  });

  describe("a signal-resistant process group at its deadline", () => {
    const it = test.extend("resistantTreeTimedOutAndWasRemoved", async ({}, { onCleanup }) => {
      const fixtureRoot = mkdtempSync(join(tmpdir(), "dont-review-it-async-process-"));
      const pidFile = join(fixtureRoot, "pids");
      onCleanup(() => {
        try {
          if (!existsSync(pidFile)) return;
          const [leaderPid] = JSON.parse(readFileSync(pidFile, "utf8")) as readonly number[];
          if (leaderPid === undefined) return;
          try {
            process.kill(-leaderPid, "SIGKILL");
          } catch (cleanupFailure) {
            if ((cleanupFailure as NodeJS.ErrnoException).code !== "ESRCH") throw cleanupFailure;
          }
        } finally {
          rmSync(fixtureRoot, { recursive: true, force: true });
        }
      });
      const program = [
        'const { spawn } = require("node:child_process");',
        'const { writeFileSync } = require("node:fs");',
        'process.on("SIGTERM", () => undefined);',
        String.raw`const descendant = spawn(process.execPath, ["-e", "process.on(\"SIGTERM\", () => undefined); setInterval(() => undefined, 1000)"]);`,
        `writeFileSync(${JSON.stringify(pidFile)}, JSON.stringify([process.pid, descendant.pid]));`,
        "setInterval(() => undefined, 1000);",
      ].join(" ");

      const processExecution = runAsyncProcess({
        label: "resistant tree",
        command: process.execPath,
        arguments_: ["-e", program],
        cwd: fixtureRoot,
        timeoutMs: RESISTANT_TREE_TIMEOUT_MS,
      });
      await vi.waitUntil(
        () =>
          existsSync(pidFile) &&
          (JSON.parse(readFileSync(pidFile, "utf8")) as readonly number[]).length === 2,
        { timeout: FIXTURE_READY_TIMEOUT_MS },
      );
      const processIdentifiers = JSON.parse(readFileSync(pidFile, "utf8")) as readonly number[];
      const [processFailure] = await attemptAsync<unknown, Error>(() => processExecution);
      if (processFailure === null) throw new Error("the resistant tree unexpectedly completed");
      const timedOutAsExpected =
        processFailure.message.includes("resistant tree") &&
        processFailure.message.includes("SIGTERM followed by SIGKILL");
      return (
        timedOutAsExpected &&
        processIdentifiers.every((processIdentifier) => {
          try {
            process.kill(processIdentifier, 0);
            return false;
          } catch (processLookupFailure) {
            return (processLookupFailure as NodeJS.ErrnoException).code === "ESRCH";
          }
        })
      );
    });

    it(
      "reports the forced termination and removes both processes",
      { timeout: TEST_TIMEOUT_MS },
      ({ resistantTreeTimedOutAndWasRemoved }) => {
        expect(resistantTreeTimedOutAndWasRemoved).toBe(true);
      },
    );
  });
});
