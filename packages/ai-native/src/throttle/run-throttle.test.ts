import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test as viteTest, vi } from "vite-plus/test";

import { runThrottle } from "./run-throttle.ts";

const TRIVIAL_COMMAND = ["--", process.execPath, "-e", ""];

const SLOT_MARKER_PATTERN = /^slot-\d+$/u;

describe("runThrottle", () => {
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

  const throttleTest = standardIoTest
    .extend("slotDirectory", ({}, { onCleanup }) => {
      const slotArea = mkdtempSync(join(tmpdir(), "throttle-run-"));
      onCleanup(() => {
        rmSync(slotArea, { recursive: true, force: true });
      });
      return slotArea;
    })
    .extend("stampsDirectory", ({}, { onCleanup }) => {
      const stampsArea = mkdtempSync(join(tmpdir(), "throttle-stamps-"));
      onCleanup(() => {
        rmSync(stampsArea, { recursive: true, force: true });
      });
      return stampsArea;
    });

  describe("a run under every default", () => {
    const it = throttleTest
      .extend("theCodeOfARunUnderEveryDefault", async ({ slotDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", undefined);
        vi.stubEnv("TMPDIR", slotDirectory);
        return runThrottle(TRIVIAL_COMMAND);
      })
      .extend("theAcquisitionNamedUnderEveryDefault", async ({ slotDirectory, stderr }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", undefined);
        vi.stubEnv("TMPDIR", slotDirectory);
        await runThrottle(TRIVIAL_COMMAND);
        return stderr.text().includes("throttle: acquiring a slot (limit 1)");
      })
      .extend("theCommandLineNamedUnderEveryDefault", async ({ slotDirectory, stderr }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", undefined);
        vi.stubEnv("TMPDIR", slotDirectory);
        await runThrottle(TRIVIAL_COMMAND);
        return stderr.text().includes(`throttle: run ${process.execPath} -e `);
      });

    it("succeeds", { timeout: 30_000 }, ({ theCodeOfARunUnderEveryDefault }) => {
      expect(theCodeOfARunUnderEveryDefault).toBe(0);
    });

    it(
      "announces the acquisition on stderr",
      { timeout: 30_000 },
      ({ theAcquisitionNamedUnderEveryDefault }) => {
        expect(theAcquisitionNamedUnderEveryDefault).toBe(true);
      },
    );

    it(
      "announces the command line on stderr",
      { timeout: 30_000 },
      ({ theCommandLineNamedUnderEveryDefault }) => {
        expect(theCommandLineNamedUnderEveryDefault).toBe(true);
      },
    );
  });

  describe("no command at all", () => {
    const it = throttleTest
      .extend("theCodeOfNoCommandAtAll", async () => runThrottle([]))
      .extend("theUsageNamedForNoCommand", async ({ stderr }) => {
        await runThrottle([]);
        return stderr.text().includes("Usage: throttle");
      })
      .extend("theStandardOutputOfNoCommand", async ({ stdout }) => {
        await runThrottle([]);
        return stdout.text();
      })
      .extend("theStandardErrorOfNoCommand", async ({ stderr }) => {
        await runThrottle([]);
        return stderr.text();
      });

    it("is refused", ({ theCodeOfNoCommandAtAll }) => {
      expect(theCodeOfNoCommandAtAll).toBe(2);
    });

    it("puts the usage on stderr", ({ theUsageNamedForNoCommand }) => {
      expect(theUsageNamedForNoCommand).toBe(true);
    });

    it("puts nothing on stdout", ({ theStandardOutputOfNoCommand }) => {
      expect(theStandardOutputOfNoCommand).toMatchInlineSnapshot(`""`);
    });

    it("puts the whole refusal on stderr", ({ theStandardErrorOfNoCommand }) => {
      expect(theStandardErrorOfNoCommand).toMatchInlineSnapshot(`
        "Usage: throttle [--timeout <seconds>] -- <command> [args...]

        Runs the command while keeping the number of simultaneous executions that
        share this host and namespace at or below the limit. When every slot is held
        the wrapper joins a wait queue, reports its position on stderr, and retries
        every slot on each poll. The default wait budget is 1900
        seconds. The operating system releases a slot when its holder exits, including
        an abrupt termination. Do not nest throttle inside a command it wraps: the inner
        call counts as one more competitor and consumes a second slot. The operating
        system's temporary directory that stores the slots must be on a local filesystem,
        not NFS, SMB, or another network filesystem. Do not delete, rename, replace, or
        clean up slot lock files while throttle processes are active.

        Options:
          --timeout <seconds>  Stop the command's whole process tree after this many
                               seconds. POSIX sends SIGTERM, then SIGKILL after a short
                               grace period; Windows uses taskkill /T /F immediately.
                               Accepts 0 through 2147483. 0 never
                               interrupts the command. Defaults to 0.

        Environment:
          MST_THROTTLE_LIMIT   Number of slots shared by every throttle on this host
                               and namespace. Invalid values (non-integer, zero or
                               less) fall back to the default of 1.

        Exit codes:
          0  the wrapped command succeeded
          1  the wrapped command failed, was killed, could not be started, ran past
             the timeout, or the wrapper could not get or release a slot
          2  throttle itself was called incorrectly
        "
      `);
    });
  });

  describe("a separator with nothing behind it", () => {
    const it = throttleTest.extend("theCodeOfASeparatorAlone", async () => runThrottle(["--"]));

    it("is refused", ({ theCodeOfASeparatorAlone }) => {
      expect(theCodeOfASeparatorAlone).toBe(2);
    });
  });

  describe("a fractional timeout", () => {
    const it = throttleTest
      .extend("theCodeOfAFractionalTimeout", async ({ slotDirectory }) =>
        runThrottle(["--timeout", "1.5", ...TRIVIAL_COMMAND], {
          slotDir: join(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        }),
      )
      .extend("theFractionalTimeoutIsNamedBack", async ({ slotDirectory, stderr }) => {
        await runThrottle(["--timeout", "1.5", ...TRIVIAL_COMMAND], {
          slotDir: join(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
        return stderr.text().includes('got "1.5"');
      })
      .extend("theSlotAreaAfterARefusedTimeout", async ({ slotDirectory }) => {
        await runThrottle(["--timeout", "1.5", ...TRIVIAL_COMMAND], {
          slotDir: join(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
        return existsSync(join(slotDirectory, "slots"));
      });

    it("is refused", ({ theCodeOfAFractionalTimeout }) => {
      expect(theCodeOfAFractionalTimeout).toBe(2);
    });

    it("is named back on stderr", ({ theFractionalTimeoutIsNamedBack }) => {
      expect(theFractionalTimeoutIsNamedBack).toBe(true);
    });

    it("leaves no slot area behind", ({ theSlotAreaAfterARefusedTimeout }) => {
      expect(theSlotAreaAfterARefusedTimeout).toBe(false);
    });
  });

  describe("a negative timeout", () => {
    const it = throttleTest
      .extend("theCodeOfANegativeTimeout", async ({ slotDirectory }) =>
        runThrottle(["--timeout=-9", ...TRIVIAL_COMMAND], {
          slotDir: join(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        }),
      )
      .extend("theNegativeTimeoutIsNamedBack", async ({ slotDirectory, stderr }) => {
        await runThrottle(["--timeout=-9", ...TRIVIAL_COMMAND], {
          slotDir: join(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
        return stderr.text().includes('got "-9"');
      });

    it("is refused", ({ theCodeOfANegativeTimeout }) => {
      expect(theCodeOfANegativeTimeout).toBe(2);
    });

    it("is named back on stderr", ({ theNegativeTimeoutIsNamedBack }) => {
      expect(theNegativeTimeoutIsNamedBack).toBe(true);
    });
  });

  describe("a timeout above Node's timer range", () => {
    const it = throttleTest
      .extend("theCodeOfATimeoutAboveTheTimerRange", async ({ slotDirectory }) =>
        runThrottle(["--timeout", "2147484", ...TRIVIAL_COMMAND], {
          slotDir: join(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        }),
      )
      .extend("theTimerRangeReasonIsNamed", async ({ slotDirectory, stderr }) => {
        await runThrottle(["--timeout", "2147484", ...TRIVIAL_COMMAND], {
          slotDir: join(slotDirectory, "slots"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
        return stderr
          .text()
          .startsWith('throttle: --timeout must be at most 2147483 seconds, got "2147484"\n');
      })
      .extend("theSlotAreaAfterATimeoutAboveTheTimerRange", async ({ slotDirectory }) => {
        const slotArea = join(slotDirectory, "slots");
        await runThrottle(["--timeout", "2147484", ...TRIVIAL_COMMAND], {
          slotDir: slotArea,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
        return existsSync(slotArea);
      });

    it("is refused", ({ theCodeOfATimeoutAboveTheTimerRange }) => {
      expect(theCodeOfATimeoutAboveTheTimerRange).toBe(2);
    });

    it("names the range and the received value", ({ theTimerRangeReasonIsNamed }) => {
      expect(theTimerRangeReasonIsNamed).toBe(true);
    });

    it("leaves no slot area behind", ({ theSlotAreaAfterATimeoutAboveTheTimerRange }) => {
      expect(theSlotAreaAfterATimeoutAboveTheTimerRange).toBe(false);
    });
  });

  describe("the greatest timeout inside Node's timer range", () => {
    const it = throttleTest.extend(
      "theCodeOfTheGreatestTimeoutInsideTheTimerRange",
      async ({ slotDirectory }) =>
        runThrottle(["--timeout", "2147483", ...TRIVIAL_COMMAND], {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        }),
    );

    it("is accepted", { timeout: 30_000 }, ({ theCodeOfTheGreatestTimeoutInsideTheTimerRange }) => {
      expect(theCodeOfTheGreatestTimeoutInsideTheTimerRange).toBe(0);
    });
  });

  describe("an unknown option", () => {
    const it = throttleTest
      .extend("theCodeOfAnUnknownOption", async () =>
        runThrottle(["--limit", "3", ...TRIVIAL_COMMAND]),
      )
      .extend("theUsageNamedForAnUnknownOption", async ({ stderr }) => {
        await runThrottle(["--limit", "3", ...TRIVIAL_COMMAND]);
        return stderr.text().includes("Usage: throttle");
      });

    it("is refused", ({ theCodeOfAnUnknownOption }) => {
      expect(theCodeOfAnUnknownOption).toBe(2);
    });

    it("puts the usage on stderr", ({ theUsageNamedForAnUnknownOption }) => {
      expect(theUsageNamedForAnUnknownOption).toBe(true);
    });
  });

  describe("two runs sharing one slot", () => {
    const it = throttleTest
      .extend("theCodesOfTwoRunsUnderOneSlot", async ({ slotDirectory, stampsDirectory }) => {
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        };
        return Promise.all([
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "a-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "a-end"))}, String(Date.now())); }, 400);`,
            ],
            seams,
          ),
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "b-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "b-end"))}, String(Date.now())); }, 400);`,
            ],
            seams,
          ),
        ]);
      })
      .extend("twoRunsUnderOneSlotNeverOverlapped", async ({ slotDirectory, stampsDirectory }) => {
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        };
        await Promise.all([
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "a-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "a-end"))}, String(Date.now())); }, 400);`,
            ],
            seams,
          ),
          runThrottle(
            [
              "--",
              process.execPath,
              "-e",
              `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "b-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "b-end"))}, String(Date.now())); }, 400);`,
            ],
            seams,
          ),
        ]);
        const aStart = Number(readFileSync(join(stampsDirectory, "a-start"), "utf8"));
        const aEnd = Number(readFileSync(join(stampsDirectory, "a-end"), "utf8"));
        const bStart = Number(readFileSync(join(stampsDirectory, "b-start"), "utf8"));
        const bEnd = Number(readFileSync(join(stampsDirectory, "b-end"), "utf8"));
        return aStart <= bStart ? bStart >= aEnd : aStart >= bEnd;
      })
      .extend(
        "theRankNamedWhileTwoRunsShareOneSlot",
        async ({ slotDirectory, stampsDirectory, stderr }) => {
          const seams = {
            slotDir: slotDirectory,
            limit: 1,
            waitBudgetMs: 15_000,
            pollMs: 50,
            isInteractive: false,
          };
          await Promise.all([
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "a-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "a-end"))}, String(Date.now())); }, 400);`,
              ],
              seams,
            ),
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "b-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "b-end"))}, String(Date.now())); }, 400);`,
              ],
              seams,
            ),
          ]);
          return stderr.text().includes("throttle: waiting 1/1");
        },
      );

    it("both run", { timeout: 20_000 }, ({ theCodesOfTwoRunsUnderOneSlot }) => {
      expect(theCodesOfTwoRunsUnderOneSlot).toStrictEqual([0, 0]);
    });

    it(
      "never run at the same time",
      { timeout: 20_000 },
      ({ twoRunsUnderOneSlotNeverOverlapped }) => {
        expect(twoRunsUnderOneSlotNeverOverlapped).toBe(true);
      },
    );

    it(
      "the one that waited names its rank on stderr",
      { timeout: 20_000 },
      ({ theRankNamedWhileTwoRunsShareOneSlot }) => {
        expect(theRankNamedWhileTwoRunsShareOneSlot).toBe(true);
      },
    );
  });

  describe("a run finding a free slot", () => {
    const it = throttleTest
      .extend("theCodeOfARunTakingAFreeSlot", async ({ slotDirectory }) =>
        runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 30_000,
          isInteractive: false,
        }),
      )
      .extend("aFreeSlotIsTakenWellBelowOnePollInterval", async ({ slotDirectory }) => {
        const before = Date.now();
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 30_000,
          isInteractive: false,
        });
        return Date.now() - before < 20_000;
      })
      .extend("theWaitingNamedWhileTakingAFreeSlot", async ({ slotDirectory, stderr }) => {
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 30_000,
          isInteractive: false,
        });
        return stderr.text().includes("waiting");
      });

    it("runs the command", { timeout: 30_000 }, ({ theCodeOfARunTakingAFreeSlot }) => {
      expect(theCodeOfARunTakingAFreeSlot).toBe(0);
    });

    it(
      "takes it well below one poll interval",
      { timeout: 30_000 },
      ({ aFreeSlotIsTakenWellBelowOnePollInterval }) => {
        expect(aFreeSlotIsTakenWellBelowOnePollInterval).toBe(true);
      },
    );

    it(
      "puts no waiting output on stderr",
      { timeout: 30_000 },
      ({ theWaitingNamedWhileTakingAFreeSlot }) => {
        expect(theWaitingNamedWhileTakingAFreeSlot).toBe(false);
      },
    );
  });

  describe("two runs in different namespaces", () => {
    const it = throttleTest
      .extend(
        "theCodesOfTwoRunsInDifferentNamespaces",
        async ({ slotDirectory, stampsDirectory }) =>
          Promise.all([
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "a-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "a-end"))}, String(Date.now())); }, 400);`,
              ],
              {
                slotDir: join(slotDirectory, "a"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              },
            ),
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "b-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "b-end"))}, String(Date.now())); }, 400);`,
              ],
              {
                slotDir: join(slotDirectory, "b"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              },
            ),
          ]),
      )
      .extend(
        "twoRunsInDifferentNamespacesOverlapped",
        async ({ slotDirectory, stampsDirectory }) => {
          await Promise.all([
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "a-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "a-end"))}, String(Date.now())); }, 400);`,
              ],
              {
                slotDir: join(slotDirectory, "a"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              },
            ),
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "b-start"))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, "b-end"))}, String(Date.now())); }, 400);`,
              ],
              {
                slotDir: join(slotDirectory, "b"),
                limit: 1,
                waitBudgetMs: 15_000,
                pollMs: 50,
                isInteractive: false,
              },
            ),
          ]);
          const aStart = Number(readFileSync(join(stampsDirectory, "a-start"), "utf8"));
          const aEnd = Number(readFileSync(join(stampsDirectory, "a-end"), "utf8"));
          const bStart = Number(readFileSync(join(stampsDirectory, "b-start"), "utf8"));
          const bEnd = Number(readFileSync(join(stampsDirectory, "b-end"), "utf8"));
          return aStart < bEnd && bStart < aEnd;
        },
      );

    it("both run", { timeout: 30_000 }, ({ theCodesOfTwoRunsInDifferentNamespaces }) => {
      expect(theCodesOfTwoRunsInDifferentNamespaces).toStrictEqual([0, 0]);
    });

    it("never contend", { timeout: 30_000 }, ({ twoRunsInDifferentNamespacesOverlapped }) => {
      expect(twoRunsInDifferentNamespacesOverlapped).toBe(true);
    });
  });

  describe("three runs under an environment limit of two", () => {
    const it = throttleTest
      .extend("theCodesOfThreeRunsUnderTwoSlots", async ({ slotDirectory, stampsDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", "2");
        const seams = {
          slotDir: slotDirectory,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        };
        return Promise.all(
          ["a", "b", "c"].map(async (stampPrefix) =>
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, `${stampPrefix}-start`))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, `${stampPrefix}-end`))}, String(Date.now())); }, 1500);`,
              ],
              seams,
            ),
          ),
        );
      })
      .extend("thePeakOfThreeRunsUnderTwoSlots", async ({ slotDirectory, stampsDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", "2");
        const seams = {
          slotDir: slotDirectory,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        };
        await Promise.all(
          ["a", "b", "c"].map(async (stampPrefix) =>
            runThrottle(
              [
                "--",
                process.execPath,
                "-e",
                `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, `${stampPrefix}-start`))}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(join(stampsDirectory, `${stampPrefix}-end`))}, String(Date.now())); }, 1500);`,
              ],
              seams,
            ),
          ),
        );
        const spans = ["a", "b", "c"].map((stampPrefix) => ({
          start: Number(readFileSync(join(stampsDirectory, `${stampPrefix}-start`), "utf8")),
          end: Number(readFileSync(join(stampsDirectory, `${stampPrefix}-end`), "utf8")),
        }));
        return Math.max(
          ...spans.map(
            ({ start }) =>
              spans.filter(
                (candidateSpan) => candidateSpan.start <= start && start < candidateSpan.end,
              ).length,
          ),
        );
      });

    it("every run finishes", { timeout: 30_000 }, ({ theCodesOfThreeRunsUnderTwoSlots }) => {
      expect(theCodesOfThreeRunsUnderTwoSlots).toStrictEqual([0, 0, 0]);
    });

    it("two really run at a time", { timeout: 30_000 }, ({ thePeakOfThreeRunsUnderTwoSlots }) => {
      expect(thePeakOfThreeRunsUnderTwoSlots).toBe(2);
    });
  });

  describe("an environment limit of two", () => {
    const it = throttleTest.extend(
      "theSecondSlotMarkerUnderALimitOfTwo",
      async ({ slotDirectory, stampsDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", "2");
        await runThrottle(
          [
            "--",
            process.execPath,
            "-e",
            `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(join(stampsDirectory, "a-start"))}, String(Date.now()));`,
          ],
          {
            slotDir: slotDirectory,
            waitBudgetMs: 15_000,
            pollMs: 50,
            isInteractive: false,
          },
        );
        return existsSync(join(slotDirectory, "slot-1"));
      },
    );

    it(
      "creates the second slot marker",
      { timeout: 30_000 },
      ({ theSecondSlotMarkerUnderALimitOfTwo }) => {
        expect(theSecondSlotMarkerUnderALimitOfTwo).toBe(true);
      },
    );
  });

  describe("a worded environment limit", () => {
    const it = throttleTest
      .extend("theCodeOfARunUnderAWordedLimit", async ({ slotDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", "abc");
        return runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          waitBudgetMs: 5000,
          pollMs: 1000,
          isInteractive: false,
        });
      })
      .extend("theMarkersUnderAWordedLimit", async ({ slotDirectory }) => {
        vi.stubEnv("MST_THROTTLE_LIMIT", "abc");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          waitBudgetMs: 5000,
          pollMs: 1000,
          isInteractive: false,
        });
        return readdirSync(slotDirectory).filter((slotFileName) =>
          SLOT_MARKER_PATTERN.test(slotFileName),
        );
      });

    it("does not fail the run", { timeout: 30_000 }, ({ theCodeOfARunUnderAWordedLimit }) => {
      expect(theCodeOfARunUnderAWordedLimit).toBe(0);
    });

    it("falls back to one slot", { timeout: 30_000 }, ({ theMarkersUnderAWordedLimit }) => {
      expect(theMarkersUnderAWordedLimit).toStrictEqual(["slot-0"]);
    });
  });

  describe("an environment limit of zero", () => {
    const it = throttleTest.extend("theMarkersUnderALimitOfZero", async ({ slotDirectory }) => {
      vi.stubEnv("MST_THROTTLE_LIMIT", "0");
      await runThrottle(TRIVIAL_COMMAND, {
        slotDir: slotDirectory,
        waitBudgetMs: 5000,
        pollMs: 1000,
        isInteractive: false,
      });
      return readdirSync(slotDirectory).filter((slotFileName) =>
        SLOT_MARKER_PATTERN.test(slotFileName),
      );
    });

    it("falls back to one slot", { timeout: 30_000 }, ({ theMarkersUnderALimitOfZero }) => {
      expect(theMarkersUnderALimitOfZero).toStrictEqual(["slot-0"]);
    });
  });

  describe("a negative environment limit", () => {
    const it = throttleTest.extend("theMarkersUnderANegativeLimit", async ({ slotDirectory }) => {
      vi.stubEnv("MST_THROTTLE_LIMIT", "-3");
      await runThrottle(TRIVIAL_COMMAND, {
        slotDir: slotDirectory,
        waitBudgetMs: 5000,
        pollMs: 1000,
        isInteractive: false,
      });
      return readdirSync(slotDirectory).filter((slotFileName) =>
        SLOT_MARKER_PATTERN.test(slotFileName),
      );
    });

    it("falls back to one slot", { timeout: 30_000 }, ({ theMarkersUnderANegativeLimit }) => {
      expect(theMarkersUnderANegativeLimit).toStrictEqual(["slot-0"]);
    });
  });

  describe("an unusable slot area", () => {
    const it = throttleTest
      .extend("theCodeOfAnUnusableSlotArea", async ({ slotDirectory }) => {
        const plainFile = join(slotDirectory, "plain-file");
        writeFileSync(plainFile, "");
        return runThrottle(TRIVIAL_COMMAND, {
          slotDir: join(plainFile, "nested"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
      })
      .extend("theFailureNamedForAnUnusableSlotArea", async ({ slotDirectory, stderr }) => {
        const plainFile = join(slotDirectory, "plain-file");
        writeFileSync(plainFile, "");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: join(plainFile, "nested"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
        return stderr.text().includes("throttle: ");
      })
      .extend("theUsageNamedForAnUnusableSlotArea", async ({ slotDirectory, stderr }) => {
        const plainFile = join(slotDirectory, "plain-file");
        writeFileSync(plainFile, "");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: join(plainFile, "nested"),
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 50,
          isInteractive: false,
        });
        return stderr.text().includes("Usage: throttle");
      });

    it("fails the run", ({ theCodeOfAnUnusableSlotArea }) => {
      expect(theCodeOfAnUnusableSlotArea).toBe(1);
    });

    it("is reported as a throttle failure", ({ theFailureNamedForAnUnusableSlotArea }) => {
      expect(theFailureNamedForAnUnusableSlotArea).toBe(true);
    });

    it("is not reported as misuse", ({ theUsageNamedForAnUnusableSlotArea }) => {
      expect(theUsageNamedForAnUnusableSlotArea).toBe(false);
    });
  });
});
