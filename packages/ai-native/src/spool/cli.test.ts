import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, test, vi } from "vite-plus/test";

import { runSpool } from "./run-spool.ts";

vi.mock(import("./run-spool.ts"), { spy: true });

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

const LARGE_OUTPUT_SCRIPT =
  'const line = "x".repeat(99) + "\\n"; for (let i = 0; i < 50000; i += 1) process.stdout.write(line);';

const LARGE_OUTPUT_COMMAND = [process.execPath, "-e", LARGE_OUTPUT_SCRIPT].join(" ");

const NESTED_OUTPUT_SCRIPT =
  'const line = "y".repeat(99) + "\\n"; for (let i = 0; i < 20000; i += 1) process.stdout.write(line);';

const FAST_WRITER_SCRIPT =
  'const chunk = "m".repeat(65536); for (let i = 0; i < 4096; i += 1) process.stdout.write(chunk);';

const FAST_WRITER_COMMAND = [process.execPath, "-e", FAST_WRITER_SCRIPT].join(" ");

const FAST_WRITER_BYTES = 4096 * 65536;

const PASSTHROUGH_SCRIPT = 'console.log("raw through"); process.exit(4);';

describe("spool cli", () => {
  describe("the entry module", () => {
    const it = test.extend("theCallTheEntryMadeToRunSpool", async ({}, { onCleanup }) => {
      const inheritedCode = process.exitCode;
      onCleanup(() => {
        process.exitCode = inheritedCode;
      });
      await import("./cli.ts");
      return vi.mocked(runSpool);
    });

    it("hands runSpool the arguments and the streams of the process it runs in", ({
      theCallTheEntryMadeToRunSpool,
    }) => {
      expect(theCallTheEntryMadeToRunSpool).toHaveBeenCalledExactlyOnceWith(process.argv.slice(2), {
        stdout: process.stdout,
        stderr: process.stderr,
      });
    });
  });

  describe("a wrapped command writing far more than a screenful", () => {
    const it = test
      .extend("theWorkTreeOfALargeOutput", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        return workTree;
      })
      .extend("theRunWrappingALargeOutput", ({ theWorkTreeOfALargeOutput }) =>
        spawnSync(process.execPath, [CLI_PATH, "--", process.execPath, "-e", LARGE_OUTPUT_SCRIPT], {
          cwd: theWorkTreeOfALargeOutput,
          env: { ...process.env, CI: "" },
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        }),
      )
      .extend("theExitCodeOfALargeOutputRun", ({ theRunWrappingALargeOutput }) => {
        const { status } = theRunWrappingALargeOutput;
        return status;
      })
      .extend("theSummaryOfALargeOutput", ({ theRunWrappingALargeOutput }) =>
        theRunWrappingALargeOutput.stdout.split("\n"),
      )
      .extend("theCountOfSummaryLinesOfALargeOutput", ({ theSummaryOfALargeOutput }) => {
        const { length } = theSummaryOfALargeOutput;
        return length;
      })
      .extend("theLogLineOfALargeOutput", ({ theSummaryOfALargeOutput }) => {
        const logLine = theSummaryOfALargeOutput.at(1);
        if (logLine === undefined) throw new Error("the summary carried no log line");
        return logLine;
      })
      .extend(
        "theLogLineOfALargeOutputNamesTheSpoolDirectory",
        ({ theLogLineOfALargeOutput, theWorkTreeOfALargeOutput }) =>
          theLogLineOfALargeOutput.includes(
            `spool: log: ${join(theWorkTreeOfALargeOutput, ".spool")}`,
          ),
      )
      .extend("theLogLineOfALargeOutputCountsEveryByteAndLine", ({ theLogLineOfALargeOutput }) =>
        theLogLineOfALargeOutput.includes("(5000000 bytes, 50000 lines)"),
      )
      .extend("theRecordsLeftByALargeOutput", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        spawnSync(process.execPath, [CLI_PATH, "--", process.execPath, "-e", LARGE_OUTPUT_SCRIPT], {
          cwd: workTree,
          env: { ...process.env, CI: "" },
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        });
        return readdirSync(join(workTree, ".spool"));
      })
      .extend("theCountOfRecordsLeftByALargeOutput", ({ theRecordsLeftByALargeOutput }) => {
        const { length } = theRecordsLeftByALargeOutput;
        return length;
      })
      .extend("theSizeOfTheRecordLeftByALargeOutput", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        spawnSync(process.execPath, [CLI_PATH, "--", process.execPath, "-e", LARGE_OUTPUT_SCRIPT], {
          cwd: workTree,
          env: { ...process.env, CI: "" },
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        });
        const recorded = readdirSync(join(workTree, ".spool")).at(0);
        if (recorded === undefined) throw new Error("the run left no record behind");
        const { size } = statSync(join(workTree, ".spool", recorded));
        return size;
      });

    it(
      "hands back the exit code of the command it wrapped",
      { timeout: 30_000 },
      ({ theExitCodeOfALargeOutputRun }) => {
        expect(theExitCodeOfALargeOutputRun).toBe(0);
      },
    );

    it(
      "keeps standard output at the three summary lines and the newline closing them",
      { timeout: 30_000 },
      ({ theCountOfSummaryLinesOfALargeOutput }) => {
        expect(theCountOfSummaryLinesOfALargeOutput).toBe(4);
      },
    );

    it(
      "names the spool directory the record went to",
      { timeout: 30_000 },
      ({ theLogLineOfALargeOutputNamesTheSpoolDirectory }) => {
        expect(theLogLineOfALargeOutputNamesTheSpoolDirectory).toBe(true);
      },
    );

    it(
      "counts every byte and every line it moved out of the way",
      { timeout: 30_000 },
      ({ theLogLineOfALargeOutputCountsEveryByteAndLine }) => {
        expect(theLogLineOfALargeOutputCountsEveryByteAndLine).toBe(true);
      },
    );

    it(
      "leaves one record behind for the one command it wrapped",
      { timeout: 30_000 },
      ({ theCountOfRecordsLeftByALargeOutput }) => {
        expect(theCountOfRecordsLeftByALargeOutput).toBe(1);
      },
    );

    it(
      "writes the command line, a blank line and the whole output into that record",
      { timeout: 30_000 },
      ({ theSizeOfTheRecordLeftByALargeOutput }) => {
        expect(theSizeOfTheRecordLeftByALargeOutput).toBe(
          LARGE_OUTPUT_COMMAND.length + 2 + 5_000_000,
        );
      },
    );
  });

  describe("a wrapped command under CI", () => {
    const it = test
      .extend("theRunUnderCi", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        return spawnSync(
          process.execPath,
          [CLI_PATH, "--", process.execPath, "-e", PASSTHROUGH_SCRIPT],
          {
            cwd: workTree,
            env: { ...process.env, CI: "true" },
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
          },
        );
      })
      .extend("theExitCodeOfARunUnderCi", ({ theRunUnderCi }) => {
        const { status } = theRunUnderCi;
        return status;
      })
      .extend("theRunUnderCiLetTheOutputThrough", ({ theRunUnderCi }) =>
        theRunUnderCi.stdout.includes("raw through\n"),
      )
      .extend("theRunUnderCiStillReportedTheExit", ({ theRunUnderCi }) =>
        theRunUnderCi.stdout.includes("spool: exit: 4 ("),
      )
      .extend("theRunUnderCiMentionedARecord", ({ theRunUnderCi }) =>
        theRunUnderCi.stdout.includes("spool: log:"),
      )
      .extend("theSpoolDirectoryExistsAfterARunUnderCi", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        spawnSync(process.execPath, [CLI_PATH, "--", process.execPath, "-e", PASSTHROUGH_SCRIPT], {
          cwd: workTree,
          env: { ...process.env, CI: "true" },
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        });
        return existsSync(join(workTree, ".spool"));
      });

    it(
      "passes the exit code of the wrapped command straight through",
      { timeout: 15_000 },
      ({ theExitCodeOfARunUnderCi }) => {
        expect(theExitCodeOfARunUnderCi).toBe(4);
      },
    );

    it(
      "lets the output of the wrapped command reach standard output unchanged",
      { timeout: 15_000 },
      ({ theRunUnderCiLetTheOutputThrough }) => {
        expect(theRunUnderCiLetTheOutputThrough).toBe(true);
      },
    );

    it(
      "still closes with the exit summary",
      { timeout: 15_000 },
      ({ theRunUnderCiStillReportedTheExit }) => {
        expect(theRunUnderCiStillReportedTheExit).toBe(true);
      },
    );

    it(
      "says nothing about a record it never wrote",
      { timeout: 15_000 },
      ({ theRunUnderCiMentionedARecord }) => {
        expect(theRunUnderCiMentionedARecord).toBe(false);
      },
    );

    it(
      "leaves the work tree without a spool directory",
      { timeout: 15_000 },
      ({ theSpoolDirectoryExistsAfterARunUnderCi }) => {
        expect(theSpoolDirectoryExistsAfterARunUnderCi).toBe(false);
      },
    );
  });

  describe("an invocation naming no command", () => {
    const it = test
      .extend("theRunWithoutACommand", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        return spawnSync(process.execPath, [CLI_PATH], {
          cwd: workTree,
          env: { ...process.env, CI: "" },
          encoding: "utf8",
          maxBuffer: 64 * 1024 * 1024,
        });
      })
      .extend("theExitCodeOfARunWithoutACommand", ({ theRunWithoutACommand }) => {
        const { status } = theRunWithoutACommand;
        return status;
      })
      .extend("theRunWithoutACommandSpelledOutTheUsage", ({ theRunWithoutACommand }) =>
        theRunWithoutACommand.stderr.includes("usage: spool -- <command> [args...]"),
      )
      .extend("theStandardOutputOfARunWithoutACommand", ({ theRunWithoutACommand }) => {
        const { stdout } = theRunWithoutACommand;
        return stdout;
      });

    it(
      "ends on the code reserved for a misuse",
      { timeout: 15_000 },
      ({ theExitCodeOfARunWithoutACommand }) => {
        expect(theExitCodeOfARunWithoutACommand).toBe(2);
      },
    );

    it(
      "puts the usage on standard error",
      { timeout: 15_000 },
      ({ theRunWithoutACommandSpelledOutTheUsage }) => {
        expect(theRunWithoutACommandSpelledOutTheUsage).toBe(true);
      },
    );

    it(
      "leaves standard output empty",
      { timeout: 15_000 },
      ({ theStandardOutputOfARunWithoutACommand }) => {
        expect(theStandardOutputOfARunWithoutACommand).toBe("");
      },
    );
  });

  describe("a wrapped command that is itself a wrapping", () => {
    const it = test
      .extend("theDoublyWrappedRun", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        return spawnSync(
          process.execPath,
          [
            CLI_PATH,
            "--",
            process.execPath,
            CLI_PATH,
            "--",
            process.execPath,
            "-e",
            NESTED_OUTPUT_SCRIPT,
          ],
          {
            cwd: workTree,
            env: { ...process.env, CI: "" },
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
          },
        );
      })
      .extend("theExitCodeOfADoublyWrappedRun", ({ theDoublyWrappedRun }) => {
        const { status } = theDoublyWrappedRun;
        return status;
      })
      .extend("theSummaryOfADoublyWrappedRun", ({ theDoublyWrappedRun }) =>
        theDoublyWrappedRun.stdout.split("\n"),
      )
      .extend("theCountOfSummaryLinesOfADoublyWrappedRun", ({ theSummaryOfADoublyWrappedRun }) => {
        const { length } = theSummaryOfADoublyWrappedRun;
        return length;
      })
      .extend("theRecordsLeftByADoublyWrappedRun", ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        spawnSync(
          process.execPath,
          [
            CLI_PATH,
            "--",
            process.execPath,
            CLI_PATH,
            "--",
            process.execPath,
            "-e",
            NESTED_OUTPUT_SCRIPT,
          ],
          {
            cwd: workTree,
            env: { ...process.env, CI: "" },
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
          },
        );
        return readdirSync(join(workTree, ".spool")).map((recordedFileName) =>
          readFileSync(join(workTree, ".spool", recordedFileName), "utf8"),
        );
      })
      .extend(
        "theCountOfRecordsLeftByADoublyWrappedRun",
        ({ theRecordsLeftByADoublyWrappedRun }) => {
          const { length } = theRecordsLeftByADoublyWrappedRun;
          return length;
        },
      )
      .extend(
        "aDoublyWrappedRunLeavesARecordOfTheOuterWrapping",
        ({ theRecordsLeftByADoublyWrappedRun }) =>
          theRecordsLeftByADoublyWrappedRun.find((recordedOutput) =>
            recordedOutput.includes("spool: log: "),
          ) !== undefined,
      )
      .extend(
        "aDoublyWrappedRunLeavesARecordOfTheInnerCommand",
        ({ theRecordsLeftByADoublyWrappedRun }) =>
          theRecordsLeftByADoublyWrappedRun.find(
            (recordedOutput) => !recordedOutput.includes("spool: log: "),
          ) !== undefined,
      )
      .extend("theOuterRecordOfADoublyWrappedRun", ({ theRecordsLeftByADoublyWrappedRun }) => {
        const outer = theRecordsLeftByADoublyWrappedRun.find((recordedOutput) =>
          recordedOutput.includes("spool: log: "),
        );
        if (outer === undefined) throw new Error("the outer wrapping left no record");
        return outer;
      })
      .extend("theInnerRecordOfADoublyWrappedRun", ({ theRecordsLeftByADoublyWrappedRun }) => {
        const inner = theRecordsLeftByADoublyWrappedRun.find(
          (recordedOutput) => !recordedOutput.includes("spool: log: "),
        );
        if (inner === undefined) throw new Error("the inner command left no record");
        return inner;
      })
      .extend(
        "theOuterRecordStaysUnderTenLines",
        ({ theOuterRecordOfADoublyWrappedRun }) =>
          theOuterRecordOfADoublyWrappedRun.split("\n").length < 10,
      )
      .extend(
        "theInnerRecordEndsOnTheLastLineTheCommandWrote",
        ({ theInnerRecordOfADoublyWrappedRun }) =>
          theInnerRecordOfADoublyWrappedRun.endsWith(`${"y".repeat(99)}\n`),
      )
      .extend(
        "theInnerRecordCarriesEveryLineTheCommandWrote",
        ({ theInnerRecordOfADoublyWrappedRun }) =>
          theInnerRecordOfADoublyWrappedRun.length > 20_000 * 100,
      );

    it(
      "hands back the exit code of the innermost command",
      { timeout: 30_000 },
      ({ theExitCodeOfADoublyWrappedRun }) => {
        expect(theExitCodeOfADoublyWrappedRun).toBe(0);
      },
    );

    it(
      "reaches the outermost caller with the same three summary lines",
      { timeout: 30_000 },
      ({ theCountOfSummaryLinesOfADoublyWrappedRun }) => {
        expect(theCountOfSummaryLinesOfADoublyWrappedRun).toBe(4);
      },
    );

    it(
      "leaves one record per wrapping",
      { timeout: 30_000 },
      ({ theCountOfRecordsLeftByADoublyWrappedRun }) => {
        expect(theCountOfRecordsLeftByADoublyWrappedRun).toBe(2);
      },
    );

    it(
      "writes a record naming the record the inner wrapping made",
      { timeout: 30_000 },
      ({ aDoublyWrappedRunLeavesARecordOfTheOuterWrapping }) => {
        expect(aDoublyWrappedRunLeavesARecordOfTheOuterWrapping).toBe(true);
      },
    );

    it(
      "writes a record naming no record at all",
      { timeout: 30_000 },
      ({ aDoublyWrappedRunLeavesARecordOfTheInnerCommand }) => {
        expect(aDoublyWrappedRunLeavesARecordOfTheInnerCommand).toBe(true);
      },
    );

    it(
      "keeps the outer record down to the summary the inner wrapping printed",
      { timeout: 30_000 },
      ({ theOuterRecordStaysUnderTenLines }) => {
        expect(theOuterRecordStaysUnderTenLines).toBe(true);
      },
    );

    it(
      "ends the inner record on the last line the innermost command wrote",
      { timeout: 30_000 },
      ({ theInnerRecordEndsOnTheLastLineTheCommandWrote }) => {
        expect(theInnerRecordEndsOnTheLastLineTheCommandWrote).toBe(true);
      },
    );

    it(
      "keeps every line the innermost command wrote in the inner record",
      { timeout: 30_000 },
      ({ theInnerRecordCarriesEveryLineTheCommandWrote }) => {
        expect(theInnerRecordCarriesEveryLineTheCommandWrote).toBe(true);
      },
    );
  });

  describe("a wrapped command writing faster than the record can be flushed", () => {
    const it = test
      .extend("theExitCodeOfAFastWriterRun", async ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        const child = spawn(
          process.execPath,
          [CLI_PATH, "--", process.execPath, "-e", FAST_WRITER_SCRIPT],
          {
            cwd: workTree,
            env: { ...process.env, CI: "" },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        await once(child, "close");
        const { exitCode } = child;
        return exitCode;
      })
      .extend("theCountOfRecordsLeftByAFastWriter", async ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        const child = spawn(
          process.execPath,
          [CLI_PATH, "--", process.execPath, "-e", FAST_WRITER_SCRIPT],
          {
            cwd: workTree,
            env: { ...process.env, CI: "" },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        await once(child, "close");
        const { length } = readdirSync(join(workTree, ".spool"));
        return length;
      })
      .extend("theSizeOfTheRecordLeftByAFastWriter", async ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        const child = spawn(
          process.execPath,
          [CLI_PATH, "--", process.execPath, "-e", FAST_WRITER_SCRIPT],
          {
            cwd: workTree,
            env: { ...process.env, CI: "" },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        await once(child, "close");
        const recorded = readdirSync(join(workTree, ".spool")).at(0);
        if (recorded === undefined) throw new Error("the run left no record behind");
        const { size } = statSync(join(workTree, ".spool", recorded));
        return size;
      })
      .extend("theResidentMemoryOfAFastWriter", async ({}, { onCleanup }) => {
        const workTree = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
        onCleanup(() => {
          rmSync(workTree, { recursive: true, force: true });
        });
        writeFileSync(join(workTree, "package.json"), "{}");
        const child = spawn(
          process.execPath,
          [CLI_PATH, "--", process.execPath, "-e", FAST_WRITER_SCRIPT],
          {
            cwd: workTree,
            env: { ...process.env, CI: "" },
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        const sampledBytes = (): number => {
          const sampled = spawnSync("ps", ["-o", "rss=", "-p", String(child.pid)], {
            encoding: "utf8",
          });
          const kiloBytes = Number.parseInt(sampled.stdout.trim(), 10);
          return Number.isNaN(kiloBytes) ? 0 : kiloBytes * 1024;
        };
        const highestUntilClosed = async (highest: number): Promise<number> => {
          if (child.exitCode !== null || child.signalCode !== null) return highest;
          await delay(50);
          return highestUntilClosed(Math.max(highest, sampledBytes()));
        };
        const sampling = highestUntilClosed(0);
        await once(child, "close");
        const highestSampled = await sampling;
        return highestSampled;
      })
      .extend(
        "aFastWriterWasEverSeenHoldingMemory",
        ({ theResidentMemoryOfAFastWriter }) => theResidentMemoryOfAFastWriter > 0,
      )
      .extend(
        "aFastWriterStaysFarBelowTheBytesItMoved",
        ({ theResidentMemoryOfAFastWriter }) =>
          theResidentMemoryOfAFastWriter > 0 && theResidentMemoryOfAFastWriter < 192 * 1024 * 1024,
      );

    it(
      "hands back the exit code of the command it wrapped",
      { timeout: 60_000 },
      ({ theExitCodeOfAFastWriterRun }) => {
        expect(theExitCodeOfAFastWriterRun).toBe(0);
      },
    );

    it(
      "leaves one record behind for the one command it wrapped",
      { timeout: 60_000 },
      ({ theCountOfRecordsLeftByAFastWriter }) => {
        expect(theCountOfRecordsLeftByAFastWriter).toBe(1);
      },
    );

    it(
      "writes the command line, a blank line and the whole output into that record",
      { timeout: 60_000 },
      ({ theSizeOfTheRecordLeftByAFastWriter }) => {
        expect(theSizeOfTheRecordLeftByAFastWriter).toBe(
          FAST_WRITER_COMMAND.length + 2 + FAST_WRITER_BYTES,
        );
      },
    );

    it(
      "was observed holding memory while it ran",
      { timeout: 60_000 },
      ({ aFastWriterWasEverSeenHoldingMemory }) => {
        expect(aFastWriterWasEverSeenHoldingMemory).toBe(true);
      },
    );

    it(
      "never grows its memory with the volume it moved",
      { timeout: 60_000 },
      ({ aFastWriterStaysFarBelowTheBytesItMoved }) => {
        expect(aFastWriterStaysFarBelowTheBytesItMoved).toBe(true);
      },
    );
  });
});
