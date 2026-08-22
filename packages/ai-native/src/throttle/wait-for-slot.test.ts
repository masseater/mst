import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, test as viteTest, vi } from "vite-plus/test";

import { runThrottle } from "./run-throttle.ts";
import { ensureSlots, tryAcquireAny } from "./slots.ts";

const TRIVIAL_COMMAND = ["--", process.execPath, "-e", ""];

const SHORT_SLEEP_COMMAND = ["--", process.execPath, "-e", "setTimeout(() => {}, 200);"];

const GAVE_UP_LINE_PATTERN = /throttle: gave up: [^\n]*\n/gu;

const RANK_LINE_PATTERN = /throttle: waiting 1\/1\n/gu;

const GAVE_UP_LINE = "throttle: gave up: every slot stayed held for the whole 400ms wait budget\n";

const EXITED_PID = 999_999_999;

describe("waitForSlot", () => {
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

  const throttleTest = standardIoTest.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-wait-"));
    onCleanup(() => {
      rmSync(temporarySlotDirectory, { recursive: true, force: true });
    });
    return temporarySlotDirectory;
  });

  describe("a slot held by a holder that is still alive", () => {
    const it = throttleTest
      .extend("theCodeOfARunBehindALiveHolder", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const pendingRun = runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 10_000,
          pollMs: 100,
          isInteractive: false,
        });
        await delay(350);
        await hold.release();
        return pendingRun;
      })
      .extend("aLiveHolderKeepsItsSlotUntilRelease", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const before = Date.now();
        const pendingRun = runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 10_000,
          pollMs: 100,
          isInteractive: false,
        });
        await delay(350);
        await hold.release();
        await pendingRun;
        const elapsed = Date.now() - before;
        return elapsed > 300 && elapsed < 20_000;
      });

    it(
      "lets the waiting run through once the slot is freed",
      { timeout: 30_000 },
      ({ theCodeOfARunBehindALiveHolder }) => {
        expect(theCodeOfARunBehindALiveHolder).toBe(0);
      },
    );

    it(
      "keeps its slot until release",
      { timeout: 30_000 },
      ({ aLiveHolderKeepsItsSlotUntilRelease }) => {
        expect(aLiveHolderKeepsItsSlotUntilRelease).toBe(true);
      },
    );
  });

  describe("two runs queued behind one holder", () => {
    const it = throttleTest
      .extend("theWaiterEntryOwnersWhileTwoRunsWait", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 60,
          isInteractive: false,
        };
        const runA = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(150);
        const runB = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(200);
        const waiting = readdirSync(join(slotDirectory, "waiters")).map((waiterFileName) =>
          waiterFileName.split("-").at(1),
        );
        await hold.release();
        await runA;
        await runB;
        return waiting;
      })
      .extend("theWaiterEntryOwnersAfterADeadEntryWasPlanted", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 60,
          isInteractive: false,
        };
        const runA = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(150);
        const runB = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(200);
        writeFileSync(
          join(slotDirectory, "waiters", `0000000000000-${String(EXITED_PID)}-deadbeef`),
          `${String(EXITED_PID)}\n`,
        );
        await delay(200);
        const waiting = readdirSync(join(slotDirectory, "waiters")).map((waiterFileName) =>
          waiterFileName.split("-").at(1),
        );
        await hold.release();
        await runA;
        await runB;
        return waiting;
      })
      .extend("theWaiterEntryOwnersAfterTheHolderReleased", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 60,
          isInteractive: false,
        };
        const runA = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(150);
        const runB = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(200);
        await hold.release();
        await delay(150);
        const waiting = readdirSync(join(slotDirectory, "waiters")).map((waiterFileName) =>
          waiterFileName.split("-").at(1),
        );
        await runA;
        await runB;
        return waiting;
      })
      .extend("theWaitersLeftOnceBothRunsFinished", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 60,
          isInteractive: false,
        };
        const runA = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(150);
        const runB = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(200);
        await hold.release();
        await runA;
        await runB;
        return readdirSync(join(slotDirectory, "waiters"));
      })
      .extend("theRankOfTheSecondWaiterIsNamed", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 60,
          isInteractive: false,
        };
        const runA = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(150);
        const runB = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(200);
        await hold.release();
        await runA;
        await runB;
        return stderr.text().includes("throttle: waiting 2/2\n");
      })
      .extend("theRankOfTheLastWaiterLeftIsNamed", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 60,
          isInteractive: false,
        };
        const runA = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(150);
        const runB = runThrottle(SHORT_SLEEP_COMMAND, seams);
        await delay(200);
        await hold.release();
        await runA;
        await runB;
        return stderr.text().includes("throttle: waiting 1/1\n");
      });

    it(
      "holds one queue entry per waiting run",
      { timeout: 30_000 },
      ({ theWaiterEntryOwnersWhileTwoRunsWait }) => {
        expect(theWaiterEntryOwnersWhileTwoRunsWait).toStrictEqual([
          String(process.pid),
          String(process.pid),
        ]);
      },
    );

    it(
      "sweeps out an entry left by a dead waiter",
      { timeout: 30_000 },
      ({ theWaiterEntryOwnersAfterADeadEntryWasPlanted }) => {
        expect(theWaiterEntryOwnersAfterADeadEntryWasPlanted).toStrictEqual([
          String(process.pid),
          String(process.pid),
        ]);
      },
    );

    it(
      "shrinks the queue as each waiter takes the slot",
      { timeout: 30_000 },
      ({ theWaiterEntryOwnersAfterTheHolderReleased }) => {
        expect(theWaiterEntryOwnersAfterTheHolderReleased).toStrictEqual([String(process.pid)]);
      },
    );

    it(
      "empties the queue once every run finished",
      { timeout: 30_000 },
      ({ theWaitersLeftOnceBothRunsFinished }) => {
        expect(theWaitersLeftOnceBothRunsFinished).toStrictEqual([]);
      },
    );

    it(
      "names the rank of the run behind the other waiter",
      { timeout: 30_000 },
      ({ theRankOfTheSecondWaiterIsNamed }) => {
        expect(theRankOfTheSecondWaiterIsNamed).toBe(true);
      },
    );

    it(
      "names the closed-up rank once the queue shrank",
      { timeout: 30_000 },
      ({ theRankOfTheLastWaiterLeftIsNamed }) => {
        expect(theRankOfTheLastWaiterLeftIsNamed).toBe(true);
      },
    );
  });

  describe("a non-interactive wait that runs out of its budget", () => {
    const it = throttleTest
      .extend("theCodeOfAFirstRunThatRanOutOfBudget", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const code = await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 100,
          isInteractive: false,
        });
        await hold.release();
        return code;
      })
      .extend("aRunThatRanOutOfBudgetWaitedTheWholeBudget", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const before = Date.now();
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 100,
          isInteractive: false,
        });
        const elapsed = Date.now() - before;
        await hold.release();
        return elapsed >= 400 && elapsed < 1500;
      })
      .extend("theGaveUpReportsOfTwoRuns", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 100,
          isInteractive: false,
        };
        await runThrottle(TRIVIAL_COMMAND, seams);
        await runThrottle(TRIVIAL_COMMAND, seams);
        await hold.release();
        return stderr.text().match(GAVE_UP_LINE_PATTERN);
      })
      .extend("theWaitersLeftAfterTheBudgetRanOut", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 100,
          isInteractive: false,
        });
        await hold.release();
        return readdirSync(join(slotDirectory, "waiters"));
      })
      .extend("theCodeOfANonInteractiveWaitOutOfBudget", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const code = await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 60,
          isInteractive: false,
        });
        await hold.release();
        return code;
      })
      .extend("aNonInteractiveWaitOverwritesNothing", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 60,
          isInteractive: false,
        });
        await hold.release();
        return stderr.text().includes("\r");
      })
      .extend("theRankLinesANonInteractiveWaitWrote", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 60,
          isInteractive: false,
        });
        await hold.release();
        return stderr.text().match(RANK_LINE_PATTERN);
      });

    it(
      "is reported as a failure",
      { timeout: 10_000 },
      ({ theCodeOfAFirstRunThatRanOutOfBudget }) => {
        expect(theCodeOfAFirstRunThatRanOutOfBudget).toBe(1);
      },
    );

    it(
      "waits the whole budget and no longer",
      { timeout: 10_000 },
      ({ aRunThatRanOutOfBudgetWaitedTheWholeBudget }) => {
        expect(aRunThatRanOutOfBudgetWaitedTheWholeBudget).toBe(true);
      },
    );

    it(
      "says it gave up once per run, in the same words every time",
      { timeout: 10_000 },
      ({ theGaveUpReportsOfTwoRuns }) => {
        expect(theGaveUpReportsOfTwoRuns).toStrictEqual([GAVE_UP_LINE, GAVE_UP_LINE]);
      },
    );

    it(
      "leaves no entry in the queue",
      { timeout: 10_000 },
      ({ theWaitersLeftAfterTheBudgetRanOut }) => {
        expect(theWaitersLeftAfterTheBudgetRanOut).toStrictEqual([]);
      },
    );

    it(
      "is reported as a failure under a shorter poll",
      { timeout: 10_000 },
      ({ theCodeOfANonInteractiveWaitOutOfBudget }) => {
        expect(theCodeOfANonInteractiveWaitOutOfBudget).toBe(1);
      },
    );

    it("overwrites nothing", { timeout: 10_000 }, ({ aNonInteractiveWaitOverwritesNothing }) => {
      expect(aNonInteractiveWaitOverwritesNothing).toBe(false);
    });

    it(
      "repeats nothing while the queue state stands still",
      { timeout: 10_000 },
      ({ theRankLinesANonInteractiveWaitWrote }) => {
        expect(theRankLinesANonInteractiveWaitWrote).toStrictEqual(["throttle: waiting 1/1\n"]);
      },
    );
  });

  describe("an interactive wait", () => {
    const it = throttleTest
      .extend("theCodeOfAnInteractiveWait", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const pendingRun = runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 100,
          isInteractive: true,
        });
        await delay(350);
        await hold.release();
        return pendingRun;
      })
      .extend("anInteractiveWaitOverwritesItsLine", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const pendingRun = runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 100,
          isInteractive: true,
        });
        await delay(350);
        await hold.release();
        await pendingRun;
        return stderr.text().includes("\r");
      })
      .extend("anInteractiveWaitNamesTheElapsedTime", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const pendingRun = runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 100,
          isInteractive: true,
        });
        await delay(350);
        await hold.release();
        await pendingRun;
        return stderr.text().includes("throttle: waiting 1/1 0s");
      })
      .extend("anInteractiveWaitClosesItsLine", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const pendingRun = runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 15_000,
          pollMs: 100,
          isInteractive: true,
        });
        await delay(350);
        await hold.release();
        await pendingRun;
        return stderr.text().includes("0s\n");
      });

    it("runs once the slot is freed", { timeout: 10_000 }, ({ theCodeOfAnInteractiveWait }) => {
      expect(theCodeOfAnInteractiveWait).toBe(0);
    });

    it("overwrites one line", { timeout: 10_000 }, ({ anInteractiveWaitOverwritesItsLine }) => {
      expect(anInteractiveWaitOverwritesItsLine).toBe(true);
    });

    it(
      "names the elapsed time",
      { timeout: 10_000 },
      ({ anInteractiveWaitNamesTheElapsedTime }) => {
        expect(anInteractiveWaitNamesTheElapsedTime).toBe(true);
      },
    );

    it(
      "closes the line it overwrote",
      { timeout: 10_000 },
      ({ anInteractiveWaitClosesItsLine }) => {
        expect(anInteractiveWaitClosesItsLine).toBe(true);
      },
    );
  });

  describe("an interactive wait that runs out of its budget", () => {
    const it = throttleTest
      .extend("theCodeOfAnInteractiveWaitOutOfBudget", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        const code = await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 300,
          pollMs: 100,
          isInteractive: true,
        });
        await hold.release();
        return code;
      })
      .extend("anInteractiveWaitOutOfBudgetClosesItsLine", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 300,
          pollMs: 100,
          isInteractive: true,
        });
        await hold.release();
        return stderr.text().includes("0s\nthrottle: gave up: ");
      })
      .extend("anInteractiveWaitOutOfBudgetReportsGivingUp", async ({ slotDirectory, stderr }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 300,
          pollMs: 100,
          isInteractive: true,
        });
        await hold.release();
        return stderr.text().includes("\r") && stderr.text().includes("gave up");
      });

    it(
      "is reported as a failure",
      { timeout: 10_000 },
      ({ theCodeOfAnInteractiveWaitOutOfBudget }) => {
        expect(theCodeOfAnInteractiveWaitOutOfBudget).toBe(1);
      },
    );

    it(
      "still closes its line",
      { timeout: 10_000 },
      ({ anInteractiveWaitOutOfBudgetClosesItsLine }) => {
        expect(anInteractiveWaitOutOfBudgetClosesItsLine).toBe(true);
      },
    );

    it(
      "says it gave up",
      { timeout: 10_000 },
      ({ anInteractiveWaitOutOfBudgetReportsGivingUp }) => {
        expect(anInteractiveWaitOutOfBudgetReportsGivingUp).toBe(true);
      },
    );
  });

  describe("the two streams of a non-interactive wait that ran out of its budget", () => {
    const it = throttleTest.extend(
      "theRunBehindASlotHeldForTheWholeBudget",
      { auto: true },
      async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const hold = await tryAcquireAny({ slotDir: slotDirectory, limit: 1 });
        if (hold === null) throw new Error("the slot was already held");
        await runThrottle(TRIVIAL_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          waitBudgetMs: 400,
          pollMs: 100,
          isInteractive: false,
        });
        await hold.release();
      },
    );

    it("puts nothing on standard output", { timeout: 10_000 }, ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });

    it("puts the rank and the giving up on standard error", { timeout: 10_000 }, ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "throttle: acquiring a slot (limit 1)
        ",
            "throttle: waiting 1/1
        ",
            "throttle: gave up: every slot stayed held for the whole 400ms wait budget
        ",
          ],
        }
      `);
    });
  });
});
