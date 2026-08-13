import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, test } from "vite-plus/test";

import { isPassthroughSignalled, runPassthrough } from "./run-passthrough.ts";

const NODE = process.execPath;

const SILENT_SCRIPT = "";

const SILENT_COMMAND_LINE = [NODE, "-e", SILENT_SCRIPT].join(" ");

const EXIT_FIVE_SCRIPT = "process.exit(5)";

const EXIT_FIVE_COMMAND_LINE = [NODE, "-e", EXIT_FIVE_SCRIPT].join(" ");

const MISSING_EXECUTABLE = "/nonexistent/never-here";

describe("isPassthroughSignalled", () => {
  describe("a signal that is neither empty nor a denial", () => {
    const it = test.extend("theReading", () => isPassthroughSignalled("1"));

    it("reads the run as one that passes the streams through", ({ theReading }) => {
      expect(theReading).toBe(true);
    });
  });

  describe("a signal denying it is CI", () => {
    const it = test.extend("theReading", () => isPassthroughSignalled("false"));

    it("reads the run as one that records", ({ theReading }) => {
      expect(theReading).toBe(false);
    });
  });

  describe("an empty signal", () => {
    const it = test.extend("theReading", () => isPassthroughSignalled(""));

    it("reads the run as one that records", ({ theReading }) => {
      expect(theReading).toBe(false);
    });
  });

  describe("a signal that was never set", () => {
    const it = test.extend("theReading", () => isPassthroughSignalled(undefined));

    it("reads the run as one that records", ({ theReading }) => {
      expect(theReading).toBe(false);
    });
  });
});

describe("runPassthrough", () => {
  describe("a command exiting with a code of its own", () => {
    const it = standardIoTest
      .extend("theCodeOfAPassedThroughRun", async () =>
        runPassthrough([NODE, "-e", EXIT_FIVE_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          monotonicNow: () => 0,
        }),
      )
      .extend("theSummaryOfAPassedThroughRun", async ({ stdout }) => {
        await runPassthrough([NODE, "-e", EXIT_FIVE_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          monotonicNow: () => 0,
        });
        return stdout.text();
      });

    it("hands the code of the command back unchanged", ({ theCodeOfAPassedThroughRun }) => {
      expect(theCodeOfAPassedThroughRun).toBe(5);
    });

    it("stands one line shorter with no record to name", ({ theSummaryOfAPassedThroughRun }) => {
      expect(theSummaryOfAPassedThroughRun).toBe(
        `spool: command: ${EXIT_FIVE_COMMAND_LINE}\nspool: exit: 5 (0.0s)\n`,
      );
    });
  });

  describe("a command that cannot be started at all", () => {
    const it = standardIoTest
      .extend("theCodeOfAPassedThroughMissingExecutable", async () =>
        runPassthrough([MISSING_EXECUTABLE], {
          stdout: process.stdout,
          stderr: process.stderr,
          monotonicNow: () => 0,
        }),
      )
      .extend("theStderrOfAPassedThroughMissingExecutable", async ({ stderr }) => {
        await runPassthrough([MISSING_EXECUTABLE], {
          stdout: process.stdout,
          stderr: process.stderr,
          monotonicNow: () => 0,
        });
        return stderr.text();
      });

    it("is refused with the code kept for a command that cannot start", ({
      theCodeOfAPassedThroughMissingExecutable,
    }) => {
      expect(theCodeOfAPassedThroughMissingExecutable).toBe(127);
    });

    it("names the reason on standard error", ({ theStderrOfAPassedThroughMissingExecutable }) => {
      expect(theStderrOfAPassedThroughMissingExecutable).toMatchInlineSnapshot(`
        "spool: command: /nonexistent/never-here
        spool: error: cannot start command: Error: spawn /nonexistent/never-here ENOENT
        "
      `);
    });
  });

  describe("a command measured just under a minute", () => {
    const it = standardIoTest.extend("theSummaryOfARunJustUnderAMinute", async ({ stdout }) => {
      const ticks = [0, 59_999].values();
      await runPassthrough([NODE, "-e", SILENT_SCRIPT], {
        stdout: process.stdout,
        stderr: process.stderr,
        monotonicNow: () => ticks.next().value ?? 0,
      });
      return stdout.text();
    });

    it("keeps the elapsed time in seconds", ({ theSummaryOfARunJustUnderAMinute }) => {
      expect(theSummaryOfARunJustUnderAMinute).toBe(
        `spool: command: ${SILENT_COMMAND_LINE}\nspool: exit: 0 (59.9s)\n`,
      );
    });
  });
});
