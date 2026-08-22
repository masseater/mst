import { spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, test as viteTest, vi } from "vite-plus/test";

import { runSpool } from "./run-spool.ts";

class CapturedStream extends PassThrough {
  private captured = "";

  constructor() {
    super();
    this.on("data", (part: Buffer) => {
      this.captured += String(part);
    });
  }

  text(): string {
    return this.captured;
  }
}

const NODE = process.execPath;

const SEAM_INSTANT = "2026-08-11T12:00:00Z";

const SEAM_SUFFIX = "cafe0123";

const SEAMED_LOG_NAME = "20260811T120000Z-node--e-cafe0123.log";

const TEST_ROOT = join(tmpdir(), "run-spool-test");

const SILENT_SCRIPT = "";

const SILENT_COMMAND_LINE = [NODE, "-e", SILENT_SCRIPT].join(" ");

const FIVE_THOUSAND_LINES_SCRIPT = 'for (let i = 0; i < 5000; i += 1) console.log("line " + i);';

const FIVE_THOUSAND_LINES_COMMAND_LINE = [NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT].join(" ");

const FIVE_THOUSAND_LINES_BODY = Array.from(
  { length: 5000 },
  (_, lineIndex) => `line ${lineIndex}\n`,
).join("");

const FIVE_THOUSAND_LINES_ROOT = join(TEST_ROOT, "five-thousand-lines");

const TEN_THOUSAND_LINES_SCRIPT = String.raw`const line = "x".repeat(99) + "\n"; for (let i = 0; i < 10000; i += 1) process.stdout.write(line);`;

const TEN_THOUSAND_LINES_COMMAND_LINE = [NODE, "-e", TEN_THOUSAND_LINES_SCRIPT].join(" ");

const TEN_THOUSAND_LINES_ROOT = join(TEST_ROOT, "ten-thousand-lines");

const HUNDRED_THOUSAND_LINES_SCRIPT = String.raw`const line = "x".repeat(99) + "\n"; for (let i = 0; i < 100000; i += 1) process.stdout.write(line);`;

const HUNDRED_THOUSAND_LINES_COMMAND_LINE = [NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT].join(" ");

const HUNDRED_THOUSAND_LINES_ROOT = join(TEST_ROOT, "hundred-thousand-lines");

const SILENT_COMMAND_ROOT = join(TEST_ROOT, "silent-command");

const ESCAPED_OUTPUT_SCRIPT = String.raw`process.stdout.write("\u001b[31mred\u001b[0m plain\n");`;

const ESCAPED_OUTPUT_COMMAND_LINE = [NODE, "-e", ESCAPED_OUTPUT_SCRIPT].join(" ");

const ESCAPED_OUTPUT_ROOT = join(TEST_ROOT, "escaped-output");

const INTERLEAVED_OUTPUT_SCRIPT = [
  "const delay = (ms) => new Promise((r) => setTimeout(r, ms));",
  '(async () => { console.log("out one"); await delay(200); console.error("err two"); await delay(200); console.log("out three"); })();',
].join(" ");

const INTERLEAVED_OUTPUT_COMMAND_LINE = [NODE, "-e", INTERLEAVED_OUTPUT_SCRIPT].join(" ");

const INTERLEAVED_OUTPUT_ROOT = join(TEST_ROOT, "interleaved-output");

const DELAYED_MARK_SCRIPT =
  'console.log("first-" + "mark"); setTimeout(() => { console.log("second-" + "mark"); }, 700);';

const DELAYED_MARK_COMMAND_LINE = [NODE, "-e", DELAYED_MARK_SCRIPT].join(" ");

const DELAYED_MARK_ROOT = join(TEST_ROOT, "delayed-mark");

const FAILING_SCRIPT = "process.exit(7)";

const FAILING_COMMAND_LINE = [NODE, "-e", FAILING_SCRIPT].join(" ");

const FAILING_ROOT = join(TEST_ROOT, "failing-command");

const THIRTY_ROWS_SCRIPT =
  'for (let i = 1; i <= 30; i += 1) console.log("row " + i); process.exit(3);';

const THIRTY_ROWS_COMMAND_LINE = [NODE, "-e", THIRTY_ROWS_SCRIPT].join(" ");

const THIRTY_ROWS_BODY = Array.from({ length: 30 }, (_, rowIndex) => `row ${rowIndex + 1}\n`).join(
  "",
);

const THIRTY_ROWS_EXCERPT = Array.from(
  { length: 20 },
  (_, rowIndex) => `row ${rowIndex + 11}\n`,
).join("");

const THIRTY_ROWS_ROOT = join(TEST_ROOT, "thirty-rows");

const PARTIAL_LINE_SCRIPT = 'process.stdout.write("partial oops"); process.exit(9);';

const PARTIAL_LINE_COMMAND_LINE = [NODE, "-e", PARTIAL_LINE_SCRIPT].join(" ");

const PARTIAL_LINE_ROOT = join(TEST_ROOT, "partial-line");

const SELF_KILLING_SCRIPT = String.raw`process.stdout.write("before signal\n", () => process.kill(process.pid, "SIGKILL"));`;

const SELF_KILLING_COMMAND_LINE = [NODE, "-e", SELF_KILLING_SCRIPT].join(" ");

const SELF_KILLING_ROOT = join(TEST_ROOT, "self-killing");

const MISSING_EXECUTABLE = "/nonexistent/never-here";

const MISSING_EXECUTABLE_ROOT = join(TEST_ROOT, "missing-executable");

const BLOCKED_ROOT_PARENT = join(TEST_ROOT, "blocked-root");

const BLOCKED_ROOT = join(BLOCKED_ROOT_PARENT, "blocked");

const SENTINEL_PATH = join(BLOCKED_ROOT_PARENT, "sentinel");

const SENTINEL_SCRIPT = 'require("node:fs").writeFileSync(process.argv[1], "ran");';

const SENTINEL_COMMAND_LINE = [NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH].join(" ");

const FIFO_ROOT = join(TEST_ROOT, "fifo-record");

const FIFO_GATE_DIRECTORY = join(TEST_ROOT, "fifo-gate");

const FIFO_GATE = join(FIFO_GATE_DIRECTORY, "gate");

const FIFO_MARKER = join(FIFO_GATE_DIRECTORY, "marker");

const FIFO_SCRIPT = [
  'const fs = require("node:fs");',
  String.raw`process.stdout.write("phase one\n");`,
  "const gate = process.argv[1];",
  "const marker = process.argv[2];",
  "const poll = () => {",
  "  if (!fs.existsSync(gate)) { setTimeout(poll, 20); return; }",
  '  process.stdout.write("y".repeat(2097152), () => { fs.writeFileSync(marker, "done"); process.exit(0); });',
  "};",
  "poll();",
].join(" ");

const FIFO_COMMAND_LINE = [NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER].join(" ");

const CONCURRENT_ROOT = join(TEST_ROOT, "concurrent");

const PID_SCRIPT = "console.log(process.pid)";

const SEAMED_NAME_ROOT = join(TEST_ROOT, "seamed-name");

const SEAMED_NAME_SCRIPT = "console.log(1)";

const LONG_IDENTIFIER_ROOT = join(TEST_ROOT, "long-identifier");

const LONG_IDENTIFIER_ARGUMENT = `${"x".repeat(60)}.js`;

const ELAPSED_SECONDS_ROOT = join(TEST_ROOT, "elapsed-seconds");

const ELAPSED_SECONDS_SCRIPT = 'console.log("h")';

const ELAPSED_SECONDS_COMMAND_LINE = [NODE, "-e", ELAPSED_SECONDS_SCRIPT].join(" ");

const DEFAULT_RUN_SCRIPT = 'console.log("default run")';

const DEFAULT_RUN_COMMAND_LINE = [NODE, "-e", DEFAULT_RUN_SCRIPT].join(" ");

describe("runSpool", () => {
  const standardIoTest = viteTest
    .extend("stdout", { auto: true }, () => {
      const stdoutWrite = vi.spyOn(process.stdout, "write").mockReturnValue(true);
      const writtenStdout = (): readonly string[] =>
        stdoutWrite.mock.calls.map(([writtenFragment]) =>
          typeof writtenFragment === "string"
            ? writtenFragment
            : new TextDecoder().decode(writtenFragment),
        );
      const capturedStdout = Object.fromEntries([]);
      Reflect.defineProperty(capturedStdout, "chunks", { enumerable: true, get: writtenStdout });
      Reflect.defineProperty(capturedStdout, "text", {
        value: () => writtenStdout().join(""),
      });
      return capturedStdout as {
        readonly chunks: readonly string[];
        readonly text: () => string;
      };
    })
    .extend("stderr", { auto: true }, () => {
      const stderrWrite = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const writtenStderr = (): readonly string[] =>
        stderrWrite.mock.calls.map(([writtenFragment]) =>
          typeof writtenFragment === "string"
            ? writtenFragment
            : new TextDecoder().decode(writtenFragment),
        );
      const capturedStderr = Object.fromEntries([]);
      Reflect.defineProperty(capturedStderr, "chunks", { enumerable: true, get: writtenStderr });
      Reflect.defineProperty(capturedStderr, "text", {
        value: () => writtenStderr().join(""),
      });
      return capturedStderr as {
        readonly chunks: readonly string[];
        readonly text: () => string;
      };
    });

  describe("an argv naming no command at all", () => {
    const it = standardIoTest.extend("theCodeOfAnEmptyArgv", { auto: true }, async () =>
      runSpool([], { stdout: process.stdout, stderr: process.stderr }),
    );

    it("is refused with the code kept for usage errors", ({ theCodeOfAnEmptyArgv }) => {
      expect(theCodeOfAnEmptyArgv).toBe(2);
    });

    it("leaves standard output untouched", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });

    it("puts the usage on standard error", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "usage: spool -- <command> [args...]

        Runs the command with its stdout and stderr recorded to a single log file
        under the repository's .spool directory, and prints a fixed-size summary
        instead of the output. Terminal escape sequences are removed from the record.
        On a non-zero exit the summary is followed by the last 20 recorded lines.
        When the CI environment variable is set to a non-empty value other than "false",
        the command's stdio passes through untouched and no log file is created.

        exit codes: the command's own code (128+signal when killed by a signal),
        127 when the command cannot start, 1 when recording fails, 2 on usage errors
        ",
          ],
        }
      `);
    });
  });

  describe("a command printing five thousand lines", () => {
    const it = standardIoTest
      .extend("theCodeOfFiveThousandLines", async ({}, { onCleanup }) => {
        rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
        });
      })
      .extend("theSummaryOfFiveThousandLines", async ({ stdout }, { onCleanup }) => {
        rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
        });
        return stdout.text();
      })
      .extend("theStderrOfFiveThousandLines", async ({ stderr }, { onCleanup }) => {
        rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
        });
        return stderr.text();
      })
      .extend("theRecordOfFiveThousandLines", async ({}, { onCleanup }) => {
        rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIVE_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", FIVE_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIVE_THOUSAND_LINES_ROOT,
        });
        return readFileSync(join(FIVE_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME), "utf8");
      });

    it(
      "carries the code of the command it wrapped",
      { timeout: 15_000 },
      ({ theCodeOfFiveThousandLines }) => {
        expect(theCodeOfFiveThousandLines).toBe(0);
      },
    );

    it(
      "stands three lines tall and counts every byte and line",
      { timeout: 15_000 },
      ({ theSummaryOfFiveThousandLines }) => {
        expect(theSummaryOfFiveThousandLines).toBe(
          `spool: command: ${FIVE_THOUSAND_LINES_COMMAND_LINE}\nspool: log: ${join(FIVE_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)} (${FIVE_THOUSAND_LINES_BODY.length} bytes, 5000 lines)\nspool: exit: 0 (0.0s)\n`,
        );
      },
    );

    it(
      "leaves standard error untouched",
      { timeout: 15_000 },
      ({ theStderrOfFiveThousandLines }) => {
        expect(theStderrOfFiveThousandLines).toBe("");
      },
    );

    it(
      "records the command and every line in order",
      { timeout: 15_000 },
      ({ theRecordOfFiveThousandLines }) => {
        expect(theRecordOfFiveThousandLines).toBe(
          `${FIVE_THOUSAND_LINES_COMMAND_LINE}\n\n${FIVE_THOUSAND_LINES_BODY}`,
        );
      },
    );
  });

  describe("a command printing ten thousand lines of a hundred bytes", () => {
    const it = standardIoTest
      .extend("theCodeOfTenThousandLines", async ({}, { onCleanup }) => {
        rmSync(TEN_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(TEN_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", TEN_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => TEN_THOUSAND_LINES_ROOT,
        });
      })
      .extend("theSummaryOfTenThousandLines", async ({ stdout }, { onCleanup }) => {
        rmSync(TEN_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(TEN_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", TEN_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => TEN_THOUSAND_LINES_ROOT,
        });
        return stdout.text();
      })
      .extend("theRecordSizeOfTenThousandLines", async ({}, { onCleanup }) => {
        rmSync(TEN_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(TEN_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", TEN_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => TEN_THOUSAND_LINES_ROOT,
        });
        return Buffer.byteLength(readFileSync(join(TEN_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)));
      });

    it(
      "carries the code of the command it wrapped",
      { timeout: 30_000 },
      ({ theCodeOfTenThousandLines }) => {
        expect(theCodeOfTenThousandLines).toBe(0);
      },
    );

    it(
      "stands three lines tall whatever the volume",
      { timeout: 30_000 },
      ({ theSummaryOfTenThousandLines }) => {
        expect(theSummaryOfTenThousandLines).toBe(
          `spool: command: ${TEN_THOUSAND_LINES_COMMAND_LINE}\nspool: log: ${join(TEN_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)} (1000000 bytes, 10000 lines)\nspool: exit: 0 (0.0s)\n`,
        );
      },
    );

    it(
      "keeps the whole output in the record",
      { timeout: 30_000 },
      ({ theRecordSizeOfTenThousandLines }) => {
        expect(theRecordSizeOfTenThousandLines).toBe(
          TEN_THOUSAND_LINES_COMMAND_LINE.length + 2 + 1_000_000,
        );
      },
    );
  });

  describe("a command printing a hundred thousand lines of a hundred bytes", () => {
    const it = standardIoTest
      .extend("theCodeOfHundredThousandLines", async ({}, { onCleanup }) => {
        rmSync(HUNDRED_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(HUNDRED_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => HUNDRED_THOUSAND_LINES_ROOT,
        });
      })
      .extend("theSummaryOfHundredThousandLines", async ({ stdout }, { onCleanup }) => {
        rmSync(HUNDRED_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(HUNDRED_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => HUNDRED_THOUSAND_LINES_ROOT,
        });
        return stdout.text();
      })
      .extend("theRecordSizeOfHundredThousandLines", async ({}, { onCleanup }) => {
        rmSync(HUNDRED_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(HUNDRED_THOUSAND_LINES_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", HUNDRED_THOUSAND_LINES_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => HUNDRED_THOUSAND_LINES_ROOT,
        });
        return Buffer.byteLength(readFileSync(join(HUNDRED_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)));
      });

    it(
      "carries the code of the command it wrapped",
      { timeout: 30_000 },
      ({ theCodeOfHundredThousandLines }) => {
        expect(theCodeOfHundredThousandLines).toBe(0);
      },
    );

    it(
      "stands three lines tall whatever the volume",
      { timeout: 30_000 },
      ({ theSummaryOfHundredThousandLines }) => {
        expect(theSummaryOfHundredThousandLines).toBe(
          `spool: command: ${HUNDRED_THOUSAND_LINES_COMMAND_LINE}\nspool: log: ${join(HUNDRED_THOUSAND_LINES_ROOT, SEAMED_LOG_NAME)} (10000000 bytes, 100000 lines)\nspool: exit: 0 (0.0s)\n`,
        );
      },
    );

    it(
      "keeps the whole output in the record",
      { timeout: 30_000 },
      ({ theRecordSizeOfHundredThousandLines }) => {
        expect(theRecordSizeOfHundredThousandLines).toBe(
          HUNDRED_THOUSAND_LINES_COMMAND_LINE.length + 2 + 10_000_000,
        );
      },
    );
  });

  describe("a command printing nothing at all", () => {
    const it = standardIoTest
      .extend("theCodeOfASilentCommand", async ({}, { onCleanup }) => {
        rmSync(SILENT_COMMAND_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(SILENT_COMMAND_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", SILENT_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => SILENT_COMMAND_ROOT,
        });
      })
      .extend("theSummaryOfASilentCommand", async ({ stdout }, { onCleanup }) => {
        rmSync(SILENT_COMMAND_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(SILENT_COMMAND_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", SILENT_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => SILENT_COMMAND_ROOT,
        });
        return stdout.text();
      });

    it("carries the code of the command it wrapped", ({ theCodeOfASilentCommand }) => {
      expect(theCodeOfASilentCommand).toBe(0);
    });

    it("counts no bytes and no lines", ({ theSummaryOfASilentCommand }) => {
      expect(theSummaryOfASilentCommand).toBe(
        `spool: command: ${SILENT_COMMAND_LINE}\nspool: log: ${join(SILENT_COMMAND_ROOT, SEAMED_LOG_NAME)} (0 bytes, 0 lines)\nspool: exit: 0 (0.0s)\n`,
      );
    });
  });

  describe("a command colouring its output with escape sequences", () => {
    const it = standardIoTest.extend("theRunColouringItsOutput", async ({}, { onCleanup }) => {
      rmSync(ESCAPED_OUTPUT_ROOT, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(ESCAPED_OUTPUT_ROOT, { recursive: true, force: true });
      });
      await runSpool(["--", NODE, "-e", ESCAPED_OUTPUT_SCRIPT], {
        stdout: process.stdout,
        stderr: process.stderr,
        isPassthrough: () => false,
        now: () => new Date(SEAM_INSTANT),
        uniqueSuffix: () => SEAM_SUFFIX,
        monotonicNow: () => 0,
        spoolRoot: () => ESCAPED_OUTPUT_ROOT,
      });
      return readFileSync(join(ESCAPED_OUTPUT_ROOT, SEAMED_LOG_NAME), "utf8");
    });

    it("keeps the visible characters and drops the escapes", ({ theRunColouringItsOutput }) => {
      expect(theRunColouringItsOutput).toBe(`${ESCAPED_OUTPUT_COMMAND_LINE}\n\nred plain\n`);
    });
  });

  describe("a command writing to both of its streams in turn", () => {
    const it = standardIoTest
      .extend("theCodeOfBothStreams", async ({}, { onCleanup }) => {
        rmSync(INTERLEAVED_OUTPUT_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(INTERLEAVED_OUTPUT_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", INTERLEAVED_OUTPUT_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => INTERLEAVED_OUTPUT_ROOT,
        });
      })
      .extend("theRecordOfBothStreams", async ({}, { onCleanup }) => {
        rmSync(INTERLEAVED_OUTPUT_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(INTERLEAVED_OUTPUT_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", INTERLEAVED_OUTPUT_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => INTERLEAVED_OUTPUT_ROOT,
        });
        return readFileSync(join(INTERLEAVED_OUTPUT_ROOT, SEAMED_LOG_NAME), "utf8");
      });

    it(
      "carries the code of the command it wrapped",
      { timeout: 15_000 },
      ({ theCodeOfBothStreams }) => {
        expect(theCodeOfBothStreams).toBe(0);
      },
    );

    it(
      "joins both streams into one record in the order they were written",
      { timeout: 15_000 },
      ({ theRecordOfBothStreams }) => {
        expect(theRecordOfBothStreams).toBe(
          `${INTERLEAVED_OUTPUT_COMMAND_LINE}\n\nout one\nerr two\nout three\n`,
        );
      },
    );
  });

  describe("a command still running after its first line", () => {
    const it = standardIoTest
      .extend("theRecordSeenWhileStillGoing", async ({}, { onCleanup }) => {
        rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        });
        const running = runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => DELAYED_MARK_ROOT,
        });
        const logPath = join(DELAYED_MARK_ROOT, SEAMED_LOG_NAME);
        while (!existsSync(logPath) || !readFileSync(logPath, "utf8").includes("first-mark")) {
          await delay(20);
        }
        const observed = readFileSync(logPath, "utf8");
        await running;
        return observed;
      })
      .extend("theOutcomeRacedWhileStillGoing", async ({}, { onCleanup }) => {
        rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        });
        const running = runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => DELAYED_MARK_ROOT,
        });
        const logPath = join(DELAYED_MARK_ROOT, SEAMED_LOG_NAME);
        while (!existsSync(logPath) || !readFileSync(logPath, "utf8").includes("first-mark")) {
          await delay(20);
        }
        const settled = await Promise.race([running, Promise.resolve("still recording")]);
        await running;
        return settled;
      })
      .extend("theCodeOfTheDelayedCommand", async ({}, { onCleanup }) => {
        rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => DELAYED_MARK_ROOT,
        });
      })
      .extend("theRecordLeftByTheDelayedCommand", async ({}, { onCleanup }) => {
        rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(DELAYED_MARK_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", DELAYED_MARK_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => DELAYED_MARK_ROOT,
        });
        return readFileSync(join(DELAYED_MARK_ROOT, SEAMED_LOG_NAME), "utf8");
      });

    it(
      "shows the lines written so far and nothing later",
      { timeout: 15_000 },
      ({ theRecordSeenWhileStillGoing }) => {
        expect(theRecordSeenWhileStillGoing).toBe(`${DELAYED_MARK_COMMAND_LINE}\n\nfirst-mark\n`);
      },
    );

    it(
      "has not settled while the command is still going",
      { timeout: 15_000 },
      ({ theOutcomeRacedWhileStillGoing }) => {
        expect(theOutcomeRacedWhileStillGoing).toBe("still recording");
      },
    );

    it(
      "carries the code of the command it wrapped",
      { timeout: 15_000 },
      ({ theCodeOfTheDelayedCommand }) => {
        expect(theCodeOfTheDelayedCommand).toBe(0);
      },
    );

    it(
      "holds the later line once the command is done",
      { timeout: 15_000 },
      ({ theRecordLeftByTheDelayedCommand }) => {
        expect(theRecordLeftByTheDelayedCommand).toBe(
          `${DELAYED_MARK_COMMAND_LINE}\n\nfirst-mark\nsecond-mark\n`,
        );
      },
    );
  });

  describe("a command exiting with a code of its own", () => {
    const it = standardIoTest
      .extend("theCodeOfARunExitingWithSeven", async ({}, { onCleanup }) => {
        rmSync(FAILING_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FAILING_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", FAILING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FAILING_ROOT,
        });
      })
      .extend("theSummaryOfARunExitingWithSeven", async ({ stdout }, { onCleanup }) => {
        rmSync(FAILING_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FAILING_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", FAILING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FAILING_ROOT,
        });
        return stdout.text();
      })
      .extend("theStderrOfARunExitingWithSeven", async ({ stderr }, { onCleanup }) => {
        rmSync(FAILING_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FAILING_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", FAILING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FAILING_ROOT,
        });
        return stderr.text();
      });

    it("hands the code of the command back unchanged", ({ theCodeOfARunExitingWithSeven }) => {
      expect(theCodeOfARunExitingWithSeven).toBe(7);
    });

    it("names the code in the summary on standard output", ({
      theSummaryOfARunExitingWithSeven,
    }) => {
      expect(theSummaryOfARunExitingWithSeven).toBe(
        `spool: command: ${FAILING_COMMAND_LINE}\nspool: log: ${join(FAILING_ROOT, SEAMED_LOG_NAME)} (0 bytes, 0 lines)\nspool: exit: 7 (0.0s)\n`,
      );
    });

    it("leaves standard error untouched", ({ theStderrOfARunExitingWithSeven }) => {
      expect(theStderrOfARunExitingWithSeven).toBe("");
    });
  });

  describe("a command printing thirty rows before failing", () => {
    const it = standardIoTest
      .extend("theCodeOfThirtyRows", async ({}, { onCleanup }) => {
        rmSync(THIRTY_ROWS_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(THIRTY_ROWS_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", THIRTY_ROWS_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => THIRTY_ROWS_ROOT,
        });
      })
      .extend("theSummaryOfThirtyRows", async ({ stdout }, { onCleanup }) => {
        rmSync(THIRTY_ROWS_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(THIRTY_ROWS_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", THIRTY_ROWS_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => THIRTY_ROWS_ROOT,
        });
        return stdout.text();
      });

    it("hands the code of the command back unchanged", ({ theCodeOfThirtyRows }) => {
      expect(theCodeOfThirtyRows).toBe(3);
    });

    it("follows the summary with the last twenty recorded rows", ({ theSummaryOfThirtyRows }) => {
      expect(theSummaryOfThirtyRows).toBe(
        `spool: command: ${THIRTY_ROWS_COMMAND_LINE}\nspool: log: ${join(THIRTY_ROWS_ROOT, SEAMED_LOG_NAME)} (${THIRTY_ROWS_BODY.length} bytes, 30 lines)\nspool: exit: 3 (0.0s)\n${THIRTY_ROWS_EXCERPT}`,
      );
    });
  });

  describe("a command failing on a line it never closed", () => {
    const it = standardIoTest
      .extend("theCodeOfAnOpenLine", async ({}, { onCleanup }) => {
        rmSync(PARTIAL_LINE_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(PARTIAL_LINE_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", PARTIAL_LINE_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => PARTIAL_LINE_ROOT,
        });
      })
      .extend("theSummaryOfAnOpenLine", async ({ stdout }, { onCleanup }) => {
        rmSync(PARTIAL_LINE_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(PARTIAL_LINE_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", PARTIAL_LINE_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => PARTIAL_LINE_ROOT,
        });
        return stdout.text();
      });

    it("hands the code of the command back unchanged", ({ theCodeOfAnOpenLine }) => {
      expect(theCodeOfAnOpenLine).toBe(9);
    });

    it("counts the unclosed line and closes it in the excerpt", ({ theSummaryOfAnOpenLine }) => {
      expect(theSummaryOfAnOpenLine).toBe(
        `spool: command: ${PARTIAL_LINE_COMMAND_LINE}\nspool: log: ${join(PARTIAL_LINE_ROOT, SEAMED_LOG_NAME)} (12 bytes, 1 lines)\nspool: exit: 9 (0.0s)\npartial oops\n`,
      );
    });
  });

  describe("a command killing itself with a signal", () => {
    const it = standardIoTest
      .extend("theCodeOfAKilledCommand", async ({}, { onCleanup }) => {
        rmSync(SELF_KILLING_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(SELF_KILLING_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", NODE, "-e", SELF_KILLING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => SELF_KILLING_ROOT,
        });
      })
      .extend("theSummaryOfAKilledCommand", async ({ stdout }, { onCleanup }) => {
        rmSync(SELF_KILLING_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(SELF_KILLING_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", SELF_KILLING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => SELF_KILLING_ROOT,
        });
        return stdout.text();
      })
      .extend("theRecordOfAKilledCommand", async ({}, { onCleanup }) => {
        rmSync(SELF_KILLING_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(SELF_KILLING_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", NODE, "-e", SELF_KILLING_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => SELF_KILLING_ROOT,
        });
        return readFileSync(join(SELF_KILLING_ROOT, SEAMED_LOG_NAME), "utf8");
      });

    it("turns the signal into a code above the signal base", ({ theCodeOfAKilledCommand }) => {
      expect(theCodeOfAKilledCommand).toBe(137);
    });

    it("names that code in the summary", ({ theSummaryOfAKilledCommand }) => {
      expect(theSummaryOfAKilledCommand).toBe(
        `spool: command: ${SELF_KILLING_COMMAND_LINE}\nspool: log: ${join(SELF_KILLING_ROOT, SEAMED_LOG_NAME)} (14 bytes, 1 lines)\nspool: exit: 137 (0.0s)\nbefore signal\n`,
      );
    });

    it("keeps everything written before the signal", ({ theRecordOfAKilledCommand }) => {
      expect(theRecordOfAKilledCommand).toBe(`${SELF_KILLING_COMMAND_LINE}\n\nbefore signal\n`);
    });
  });

  describe("a command that cannot be started at all", () => {
    const it = standardIoTest
      .extend("theCodeOfAMissingExecutable", async ({}, { onCleanup }) => {
        rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        });
        return runSpool(["--", MISSING_EXECUTABLE], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => MISSING_EXECUTABLE_ROOT,
        });
      })
      .extend("theStdoutOfAMissingExecutable", async ({ stdout }, { onCleanup }) => {
        rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", MISSING_EXECUTABLE], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => MISSING_EXECUTABLE_ROOT,
        });
        return stdout.text();
      })
      .extend("theStderrOfAMissingExecutable", async ({ stderr }, { onCleanup }) => {
        rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", MISSING_EXECUTABLE], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => MISSING_EXECUTABLE_ROOT,
        });
        return stderr.text();
      })
      .extend("theRecordsLeftByAMissingExecutable", async ({}, { onCleanup }) => {
        rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(MISSING_EXECUTABLE_ROOT, { recursive: true, force: true });
        });
        await runSpool(["--", MISSING_EXECUTABLE], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => MISSING_EXECUTABLE_ROOT,
        });
        return readdirSync(MISSING_EXECUTABLE_ROOT);
      });

    it("is refused with the code kept for a command that cannot start", ({
      theCodeOfAMissingExecutable,
    }) => {
      expect(theCodeOfAMissingExecutable).toBe(127);
    });

    it("leaves standard output untouched", ({ theStdoutOfAMissingExecutable }) => {
      expect(theStdoutOfAMissingExecutable).toBe("");
    });

    it("names the reason on standard error", ({ theStderrOfAMissingExecutable }) => {
      expect(theStderrOfAMissingExecutable).toMatchInlineSnapshot(`
        "spool: command: /nonexistent/never-here
        spool: error: cannot start command: Error: spawn /nonexistent/never-here ENOENT
        "
      `);
    });

    it("leaves no record behind", ({ theRecordsLeftByAMissingExecutable }) => {
      expect(theRecordsLeftByAMissingExecutable).toStrictEqual([]);
    });
  });

  describe("a spool root that cannot be made a directory", () => {
    const it = standardIoTest
      .extend("theCodeOfABlockedRoot", async ({}, { onCleanup }) => {
        rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        });
        mkdirSync(BLOCKED_ROOT_PARENT, { recursive: true });
        writeFileSync(BLOCKED_ROOT, "occupied");
        return runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => BLOCKED_ROOT,
        });
      })
      .extend("theStdoutOfABlockedRoot", async ({ stdout }, { onCleanup }) => {
        rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        });
        mkdirSync(BLOCKED_ROOT_PARENT, { recursive: true });
        writeFileSync(BLOCKED_ROOT, "occupied");
        await runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => BLOCKED_ROOT,
        });
        return stdout.text();
      })
      .extend("theStderrOfABlockedRoot", async ({ stderr }, { onCleanup }) => {
        rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        });
        mkdirSync(BLOCKED_ROOT_PARENT, { recursive: true });
        writeFileSync(BLOCKED_ROOT, "occupied");
        await runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => BLOCKED_ROOT,
        });
        return stderr.text();
      })
      .extend("theEntriesLeftBesideABlockedRoot", async ({}, { onCleanup }) => {
        rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(BLOCKED_ROOT_PARENT, { recursive: true, force: true });
        });
        mkdirSync(BLOCKED_ROOT_PARENT, { recursive: true });
        writeFileSync(BLOCKED_ROOT, "occupied");
        await runSpool(["--", NODE, "-e", SENTINEL_SCRIPT, SENTINEL_PATH], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => BLOCKED_ROOT,
        });
        return readdirSync(BLOCKED_ROOT_PARENT);
      });

    it("is refused with the code kept for a failed recording", ({ theCodeOfABlockedRoot }) => {
      expect(theCodeOfABlockedRoot).toBe(1);
    });

    it("leaves standard output untouched", ({ theStdoutOfABlockedRoot }) => {
      expect(theStdoutOfABlockedRoot).toBe("");
    });

    it("names the record it could not open on standard error", ({ theStderrOfABlockedRoot }) => {
      expect(theStderrOfABlockedRoot).toBe(
        `spool: command: ${SENTINEL_COMMAND_LINE}\nspool: error: cannot record to ${join(BLOCKED_ROOT, SEAMED_LOG_NAME)}: Error: EEXIST: file already exists, mkdir '${BLOCKED_ROOT}'\n`,
      );
    });

    it("never lets the command run", ({ theEntriesLeftBesideABlockedRoot }) => {
      expect(theEntriesLeftBesideABlockedRoot).toStrictEqual(["blocked"]);
    });
  });

  describe("a record that breaks while the command is still writing", () => {
    const it = standardIoTest
      .extend("theCodeOfALostRecord", async ({}, { onCleanup }) => {
        rmSync(FIFO_ROOT, { recursive: true, force: true });
        rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIFO_ROOT, { recursive: true, force: true });
          rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        });
        mkdirSync(FIFO_ROOT, { recursive: true });
        mkdirSync(FIFO_GATE_DIRECTORY, { recursive: true });
        const fifoPath = join(FIFO_ROOT, SEAMED_LOG_NAME);
        if (spawnSync("mkfifo", [fifoPath]).status !== 0) {
          throw new Error(`could not create the pipe at ${fifoPath}`);
        }
        const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIFO_ROOT,
        });
        const reader = createReadStream(fifoPath);
        const observed = new CapturedStream();
        reader.pipe(observed);
        while (!observed.text().includes("phase one")) {
          await delay(20);
        }
        reader.destroy();
        writeFileSync(FIFO_GATE, "open");
        return running;
      })
      .extend("theStdoutOfALostRecord", async ({ stdout }, { onCleanup }) => {
        rmSync(FIFO_ROOT, { recursive: true, force: true });
        rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIFO_ROOT, { recursive: true, force: true });
          rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        });
        mkdirSync(FIFO_ROOT, { recursive: true });
        mkdirSync(FIFO_GATE_DIRECTORY, { recursive: true });
        const fifoPath = join(FIFO_ROOT, SEAMED_LOG_NAME);
        if (spawnSync("mkfifo", [fifoPath]).status !== 0) {
          throw new Error(`could not create the pipe at ${fifoPath}`);
        }
        const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIFO_ROOT,
        });
        const reader = createReadStream(fifoPath);
        const observed = new CapturedStream();
        reader.pipe(observed);
        while (!observed.text().includes("phase one")) {
          await delay(20);
        }
        reader.destroy();
        writeFileSync(FIFO_GATE, "open");
        await running;
        return stdout.text();
      })
      .extend("theStderrOfALostRecord", async ({ stderr }, { onCleanup }) => {
        rmSync(FIFO_ROOT, { recursive: true, force: true });
        rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIFO_ROOT, { recursive: true, force: true });
          rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        });
        mkdirSync(FIFO_ROOT, { recursive: true });
        mkdirSync(FIFO_GATE_DIRECTORY, { recursive: true });
        const fifoPath = join(FIFO_ROOT, SEAMED_LOG_NAME);
        if (spawnSync("mkfifo", [fifoPath]).status !== 0) {
          throw new Error(`could not create the pipe at ${fifoPath}`);
        }
        const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIFO_ROOT,
        });
        const reader = createReadStream(fifoPath);
        const observed = new CapturedStream();
        reader.pipe(observed);
        while (!observed.text().includes("phase one")) {
          await delay(20);
        }
        reader.destroy();
        writeFileSync(FIFO_GATE, "open");
        await running;
        return stderr.text();
      })
      .extend("theMarkerLeftByALostRecord", async ({}, { onCleanup }) => {
        rmSync(FIFO_ROOT, { recursive: true, force: true });
        rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(FIFO_ROOT, { recursive: true, force: true });
          rmSync(FIFO_GATE_DIRECTORY, { recursive: true, force: true });
        });
        mkdirSync(FIFO_ROOT, { recursive: true });
        mkdirSync(FIFO_GATE_DIRECTORY, { recursive: true });
        const fifoPath = join(FIFO_ROOT, SEAMED_LOG_NAME);
        if (spawnSync("mkfifo", [fifoPath]).status !== 0) {
          throw new Error(`could not create the pipe at ${fifoPath}`);
        }
        const running = runSpool(["--", NODE, "-e", FIFO_SCRIPT, FIFO_GATE, FIFO_MARKER], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => 0,
          spoolRoot: () => FIFO_ROOT,
        });
        const reader = createReadStream(fifoPath);
        const observed = new CapturedStream();
        reader.pipe(observed);
        while (!observed.text().includes("phase one")) {
          await delay(20);
        }
        reader.destroy();
        writeFileSync(FIFO_GATE, "open");
        await running;
        return readFileSync(FIFO_MARKER, "utf8");
      });

    it(
      "is refused with the code kept for a failed recording",
      { timeout: 15_000 },
      ({ theCodeOfALostRecord }) => {
        expect(theCodeOfALostRecord).toBe(1);
      },
    );

    it("leaves standard output untouched", { timeout: 15_000 }, ({ theStdoutOfALostRecord }) => {
      expect(theStdoutOfALostRecord).toBe("");
    });

    it(
      "names the record it lost on standard error",
      { timeout: 15_000 },
      ({ theStderrOfALostRecord }) => {
        expect(theStderrOfALostRecord).toBe(
          `spool: command: ${FIFO_COMMAND_LINE}\nspool: error: cannot record to ${join(FIFO_ROOT, SEAMED_LOG_NAME)}: Error: EPIPE: broken pipe, write\n`,
        );
      },
    );

    it(
      "lets the command run to its own end",
      { timeout: 15_000 },
      ({ theMarkerLeftByALostRecord }) => {
        expect(theMarkerLeftByALostRecord).toBe("done");
      },
    );
  });

  describe("a run told to pass the streams through", () => {
    const it = standardIoTest.extend("theSummaryOfAPassedThroughRun", async ({ stdout }) => {
      await runSpool(["--", NODE, "-e", SILENT_SCRIPT], {
        stdout: process.stdout,
        stderr: process.stderr,
        isPassthrough: () => true,
        monotonicNow: () => 0,
      });
      return stdout.text();
    });

    it("hands the run to the passing through route, which names no record", ({
      theSummaryOfAPassedThroughRun,
    }) => {
      expect(theSummaryOfAPassedThroughRun).toBe(
        `spool: command: ${SILENT_COMMAND_LINE}\nspool: exit: 0 (0.0s)\n`,
      );
    });
  });

  describe("five runs recording into one spool root at once", () => {
    const it = standardIoTest
      .extend("theCodesOfFiveConcurrentRuns", async ({}, { onCleanup }) => {
        rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        });
        return Promise.all(
          Array.from({ length: 5 }, async () => {
            return runSpool(["--", NODE, "-e", PID_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              spoolRoot: () => CONCURRENT_ROOT,
              now: () => new Date(SEAM_INSTANT),
              monotonicNow: () => 0,
            });
          }),
        );
      })
      .extend("theRecordNameShapesOfFiveConcurrentRuns", async ({}, { onCleanup }) => {
        rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        });
        await Promise.all(
          Array.from({ length: 5 }, async () => {
            return runSpool(["--", NODE, "-e", PID_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              spoolRoot: () => CONCURRENT_ROOT,
              now: () => new Date(SEAM_INSTANT),
              monotonicNow: () => 0,
            });
          }),
        );
        return readdirSync(CONCURRENT_ROOT).map((logFileName) =>
          /^\d{8}T\d{6}Z-node--e-[0-9a-f]{8}\.log$/.test(logFileName),
        );
      })
      .extend("theWholeLineShapesOfFiveConcurrentRuns", async ({}, { onCleanup }) => {
        rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        });
        await Promise.all(
          Array.from({ length: 5 }, async () => {
            return runSpool(["--", NODE, "-e", PID_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              spoolRoot: () => CONCURRENT_ROOT,
              now: () => new Date(SEAM_INSTANT),
              monotonicNow: () => 0,
            });
          }),
        );
        return readdirSync(CONCURRENT_ROOT).map((logFileName) =>
          /^\d+\n$/.test(
            readFileSync(join(CONCURRENT_ROOT, logFileName), "utf8").split("\n\n")[1] ?? "",
          ),
        );
      })
      .extend("theFirstAppearanceShapesOfFiveConcurrentRunBodies", async ({}, { onCleanup }) => {
        rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(CONCURRENT_ROOT, { recursive: true, force: true });
        });
        await Promise.all(
          Array.from({ length: 5 }, async () => {
            return runSpool(["--", NODE, "-e", PID_SCRIPT], {
              stdout: process.stdout,
              stderr: process.stderr,
              isPassthrough: () => false,
              spoolRoot: () => CONCURRENT_ROOT,
              now: () => new Date(SEAM_INSTANT),
              monotonicNow: () => 0,
            });
          }),
        );
        const recordedPidLines = readdirSync(CONCURRENT_ROOT).map(
          (logFileName) =>
            readFileSync(join(CONCURRENT_ROOT, logFileName), "utf8").split("\n\n")[1] ?? "",
        );
        return recordedPidLines.map(
          (recordedPidLine, index) => recordedPidLines.indexOf(recordedPidLine) === index,
        );
      });

    it(
      "hands every code back unchanged",
      { timeout: 15_000 },
      ({ theCodesOfFiveConcurrentRuns }) => {
        expect(theCodesOfFiveConcurrentRuns).toStrictEqual([0, 0, 0, 0, 0]);
      },
    );

    it(
      "gives each run a record of its own",
      { timeout: 15_000 },
      ({ theRecordNameShapesOfFiveConcurrentRuns }) => {
        expect(theRecordNameShapesOfFiveConcurrentRuns).toStrictEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      },
    );

    it(
      "closes each record on the single line its command wrote",
      { timeout: 15_000 },
      ({ theWholeLineShapesOfFiveConcurrentRuns }) => {
        expect(theWholeLineShapesOfFiveConcurrentRuns).toStrictEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      },
    );

    it(
      "keeps the runs from mixing into one another",
      { timeout: 15_000 },
      ({ theFirstAppearanceShapesOfFiveConcurrentRunBodies }) => {
        expect(theFirstAppearanceShapesOfFiveConcurrentRunBodies).toStrictEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
      },
    );
  });

  describe("a run seamed with a fixed instant and a fixed unique part", () => {
    const it = standardIoTest.extend("theRecordsNamedBySeams", async ({}, { onCleanup }) => {
      rmSync(SEAMED_NAME_ROOT, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(SEAMED_NAME_ROOT, { recursive: true, force: true });
      });
      await runSpool(["--", NODE, "-e", SEAMED_NAME_SCRIPT], {
        stdout: process.stdout,
        stderr: process.stderr,
        isPassthrough: () => false,
        now: () => new Date("2026-08-11T12:00:00.789Z"),
        uniqueSuffix: () => SEAM_SUFFIX,
        monotonicNow: () => 0,
        spoolRoot: () => SEAMED_NAME_ROOT,
      });
      return readdirSync(SEAMED_NAME_ROOT);
    });

    it("names the record by the instant, the command and the unique part", ({
      theRecordsNamedBySeams,
    }) => {
      expect(theRecordsNamedBySeams).toStrictEqual([SEAMED_LOG_NAME]);
    });
  });

  describe("a run whose command identifier runs past forty characters", () => {
    const it = standardIoTest.extend("theRecordsNamedByALongCommand", async ({}, { onCleanup }) => {
      rmSync(LONG_IDENTIFIER_ROOT, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(LONG_IDENTIFIER_ROOT, { recursive: true, force: true });
      });
      await runSpool(["--", NODE, LONG_IDENTIFIER_ARGUMENT], {
        stdout: process.stdout,
        stderr: process.stderr,
        isPassthrough: () => false,
        now: () => new Date("2026-08-11T12:00:00.789Z"),
        uniqueSuffix: () => SEAM_SUFFIX,
        monotonicNow: () => 0,
        spoolRoot: () => LONG_IDENTIFIER_ROOT,
      });
      return readdirSync(LONG_IDENTIFIER_ROOT);
    });

    it("cuts the identifier at forty characters", ({ theRecordsNamedByALongCommand }) => {
      expect(theRecordsNamedByALongCommand).toStrictEqual([
        `20260811T120000Z-node-${"x".repeat(35)}-${SEAM_SUFFIX}.log`,
      ]);
    });
  });

  describe("a run measured at twelve and a bit seconds", () => {
    const it = standardIoTest.extend(
      "theSummaryOfATwelveSecondRun",
      async ({ stdout }, { onCleanup }) => {
        rmSync(ELAPSED_SECONDS_ROOT, { recursive: true, force: true });
        onCleanup(() => {
          rmSync(ELAPSED_SECONDS_ROOT, { recursive: true, force: true });
        });
        const ticks = [0, 12_399].values();
        await runSpool(["--", NODE, "-e", ELAPSED_SECONDS_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
          isPassthrough: () => false,
          spoolRoot: () => ELAPSED_SECONDS_ROOT,
          now: () => new Date(SEAM_INSTANT),
          uniqueSuffix: () => SEAM_SUFFIX,
          monotonicNow: () => ticks.next().value ?? 0,
        });
        return stdout.text();
      },
    );

    it("cuts the elapsed time down to a tenth of a second", ({ theSummaryOfATwelveSecondRun }) => {
      expect(theSummaryOfATwelveSecondRun).toBe(
        `spool: command: ${ELAPSED_SECONDS_COMMAND_LINE}\nspool: log: ${join(ELAPSED_SECONDS_ROOT, SEAMED_LOG_NAME)} (2 bytes, 1 lines)\nspool: exit: 0 (12.3s)\n`,
      );
    });
  });

  describe("a run handed no seams at all", () => {
    const it = standardIoTest
      .extend("theCodeOfADefaultRun", async ({ stdout }, { onCleanup }) => {
        vi.stubEnv("CI", undefined);
        const exitCode = await runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
        });
        onCleanup(() => {
          rmSync(/spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "", {
            force: true,
          });
        });
        return exitCode;
      })
      .extend("theSpoolDirectoryOfADefaultRun", async ({ stdout }, { onCleanup }) => {
        vi.stubEnv("CI", undefined);
        await runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
        });
        const recordPath =
          /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "";
        onCleanup(() => {
          rmSync(recordPath, { force: true });
        });
        return dirname(recordPath);
      })
      .extend("theRecordNameShapeOfADefaultRun", async ({ stdout }, { onCleanup }) => {
        vi.stubEnv("CI", undefined);
        await runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
        });
        const recordPath =
          /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "";
        onCleanup(() => {
          rmSync(recordPath, { force: true });
        });
        return /^\d{8}T\d{6}Z-node--e-[0-9a-f]{8}\.log$/.test(basename(recordPath));
      })
      .extend("theRecordOfADefaultRun", async ({ stdout }, { onCleanup }) => {
        vi.stubEnv("CI", undefined);
        await runSpool(["--", NODE, "-e", DEFAULT_RUN_SCRIPT], {
          stdout: process.stdout,
          stderr: process.stderr,
        });
        const recordPath =
          /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout.text())?.[1] ?? "";
        onCleanup(() => {
          rmSync(recordPath, { force: true });
        });
        return readFileSync(recordPath, "utf8");
      });

    it("hands the code of the command back unchanged", ({ theCodeOfADefaultRun }) => {
      expect(theCodeOfADefaultRun).toBe(0);
    });

    it("records into the spool directory of the work tree", ({
      theSpoolDirectoryOfADefaultRun,
    }) => {
      expect(theSpoolDirectoryOfADefaultRun).toBe(join(process.cwd(), ".spool"));
    });

    it("names the record by the instant, the command and a random unique part", ({
      theRecordNameShapeOfADefaultRun,
    }) => {
      expect(theRecordNameShapeOfADefaultRun).toBe(true);
    });

    it("records the command and everything it wrote", ({ theRecordOfADefaultRun }) => {
      expect(theRecordOfADefaultRun).toBe(`${DEFAULT_RUN_COMMAND_LINE}\n\ndefault run\n`);
    });
  });
});
