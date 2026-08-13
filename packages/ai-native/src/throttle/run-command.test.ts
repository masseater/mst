import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect } from "vite-plus/test";

import { runWithSlot } from "./run-command.ts";
import { runThrottle } from "./run-throttle.ts";

const TRIVIAL_COMMAND = ["--", process.execPath, "-e", ""];

const FAILING_COMMAND = ["--", process.execPath, "-e", "process.exit(3);"];

const SELF_KILLING_COMMAND = [
  "--",
  process.execPath,
  "-e",
  "process.kill(process.pid, 'SIGTERM');",
];

const MISSING_EXECUTABLE = "/no/such/executable-for-throttle";

const SLEEPING_COMMAND = [
  "--timeout",
  "1",
  "--",
  process.execPath,
  "-e",
  "setTimeout(() => {}, 30000);",
];

const STALE_MS = 5000;

const WAIT_BUDGET_MS = 30_000;

const POLL_MS = 10_000;

describe("runWithSlot", () => {
  const throttleTest = standardIoTest.extend("slotDirectory", ({}, { onCleanup }) => {
    const madeSlotDirectory = mkdtempSync(join(tmpdir(), "throttle-command-"));
    onCleanup(() => {
      rmSync(madeSlotDirectory, { recursive: true, force: true });
    });
    return madeSlotDirectory;
  });

  describe("a command that exits zero", () => {
    const it = throttleTest.extend("theCodeOfATrivialCommand", async ({ slotDirectory }) =>
      runThrottle(TRIVIAL_COMMAND, {
        slotDir: slotDirectory,
        limit: 1,
        staleMs: STALE_MS,
        waitBudgetMs: WAIT_BUDGET_MS,
        pollMs: POLL_MS,
        isInteractive: false,
      }),
    );

    it("is reported as a pass", { timeout: 30_000 }, ({ theCodeOfATrivialCommand }) => {
      expect(theCodeOfATrivialCommand).toBe(0);
    });
  });

  describe("a command that runs after a failed one", () => {
    const it = throttleTest.extend(
      "theCodeOfARunFollowingAFailedOne",
      async ({ slotDirectory }) => {
        const seams = {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        };
        await runThrottle(FAILING_COMMAND, seams);
        return runThrottle(TRIVIAL_COMMAND, seams);
      },
    );

    it(
      "takes the slot the failed run released",
      { timeout: 30_000 },
      ({ theCodeOfARunFollowingAFailedOne }) => {
        expect(theCodeOfARunFollowingAFailedOne).toBe(0);
      },
    );
  });

  describe("a command that exits non-zero", () => {
    const it = throttleTest
      .extend("theCodeOfACommandThatExitedNonZero", async ({ slotDirectory }) =>
        runThrottle(FAILING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }),
      )
      .extend("theExitCodeIsNamedOnStderr", async ({ slotDirectory, stderr }) => {
        await runThrottle(FAILING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        });
        return stderr.text().includes("failed with exit code 3");
      });

    it(
      "is reported as a failure",
      { timeout: 30_000 },
      ({ theCodeOfACommandThatExitedNonZero }) => {
        expect(theCodeOfACommandThatExitedNonZero).toBe(1);
      },
    );

    it("names the exit code on stderr", { timeout: 30_000 }, ({ theExitCodeIsNamedOnStderr }) => {
      expect(theExitCodeIsNamedOnStderr).toBe(true);
    });
  });

  describe("a command killed by a signal", () => {
    const it = throttleTest
      .extend("theCodeOfACommandThatWasKilled", async ({ slotDirectory }) =>
        runThrottle(SELF_KILLING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }),
      )
      .extend("theSignalIsNamedOnStderr", async ({ slotDirectory, stderr }) => {
        await runThrottle(SELF_KILLING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        });
        return stderr.text().includes("was killed by SIGTERM");
      });

    it("is reported as a failure", { timeout: 30_000 }, ({ theCodeOfACommandThatWasKilled }) => {
      expect(theCodeOfACommandThatWasKilled).toBe(1);
    });

    it("names the signal on stderr", { timeout: 30_000 }, ({ theSignalIsNamedOnStderr }) => {
      expect(theSignalIsNamedOnStderr).toBe(true);
    });
  });

  describe("a command that cannot start", () => {
    const it = throttleTest
      .extend("theCodeOfACommandThatCouldNotStart", async ({ slotDirectory }) =>
        runThrottle(["--", MISSING_EXECUTABLE], {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }),
      )
      .extend("theUnstartableCommandIsNamedOnStderr", async ({ slotDirectory, stderr }) => {
        await runThrottle(["--", MISSING_EXECUTABLE], {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        });
        return stderr.text().includes(`could not start ${MISSING_EXECUTABLE}`);
      });

    it(
      "is reported as a failure",
      { timeout: 30_000 },
      ({ theCodeOfACommandThatCouldNotStart }) => {
        expect(theCodeOfACommandThatCouldNotStart).toBe(1);
      },
    );

    it(
      "names the command on stderr",
      { timeout: 30_000 },
      ({ theUnstartableCommandIsNamedOnStderr }) => {
        expect(theUnstartableCommandIsNamedOnStderr).toBe(true);
      },
    );
  });

  describe("a command that runs past its timeout", () => {
    const it = throttleTest
      .extend("theCodeOfACommandThatRanPastItsTimeout", async ({ slotDirectory }) =>
        runThrottle(SLEEPING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }),
      )
      .extend("theTimeoutIsNamedOnStderr", async ({ slotDirectory, stderr }) => {
        await runThrottle(SLEEPING_COMMAND, {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        });
        return stderr.text().includes("ran past the 1s timeout");
      });

    it(
      "is reported as a failure",
      { timeout: 30_000 },
      ({ theCodeOfACommandThatRanPastItsTimeout }) => {
        expect(theCodeOfACommandThatRanPastItsTimeout).toBe(1);
      },
    );

    it("names the timeout on stderr", { timeout: 30_000 }, ({ theTimeoutIsNamedOnStderr }) => {
      expect(theTimeoutIsNamedOnStderr).toBe(true);
    });
  });

  describe("a fast command under a long timeout", () => {
    const it = throttleTest
      .extend("theCodeOfAFastCommandUnderALongTimeout", async ({ slotDirectory }) =>
        runThrottle(["--timeout", "30", ...TRIVIAL_COMMAND], {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        }),
      )
      .extend("theFastCommandReturnedAtOnce", async ({ slotDirectory }) => {
        const before = Date.now();
        await runThrottle(["--timeout", "30", ...TRIVIAL_COMMAND], {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        });
        return Date.now() - before < 5000;
      });

    it(
      "is reported as a pass",
      { timeout: 10_000 },
      ({ theCodeOfAFastCommandUnderALongTimeout }) => {
        expect(theCodeOfAFastCommandUnderALongTimeout).toBe(0);
      },
    );

    it(
      "returns without waiting for the timeout that never fires",
      { timeout: 10_000 },
      ({ theFastCommandReturnedAtOnce }) => {
        expect(theFastCommandReturnedAtOnce).toBe(true);
      },
    );
  });

  describe("a stubborn process tree that ignores SIGTERM", () => {
    const it = throttleTest
      .extend("stampsDirectory", ({}, { onCleanup }) => {
        const madeStampsDirectory = mkdtempSync(join(tmpdir(), "throttle-tree-stamps-"));
        onCleanup(() => {
          rmSync(madeStampsDirectory, { recursive: true, force: true });
        });
        return madeStampsDirectory;
      })
      .extend("theCodeOfAStubbornProcessTree", async ({ slotDirectory, stampsDirectory }) =>
        runThrottle(
          [
            "--timeout",
            "5",
            "--",
            "sh",
            "-c",
            `trap "" TERM; sleep 30 & echo $! > "${join(stampsDirectory, "grandchild-pid")}"; wait`,
          ],
          {
            slotDir: slotDirectory,
            limit: 1,
            staleMs: STALE_MS,
            waitBudgetMs: WAIT_BUDGET_MS,
            pollMs: POLL_MS,
            isInteractive: false,
          },
        ),
      )
      .extend(
        "theStubbornTimeoutIsNamedOnStderr",
        async ({ slotDirectory, stampsDirectory, stderr }) => {
          await runThrottle(
            [
              "--timeout",
              "5",
              "--",
              "sh",
              "-c",
              `trap "" TERM; sleep 30 & echo $! > "${join(stampsDirectory, "grandchild-pid")}"; wait`,
            ],
            {
              slotDir: slotDirectory,
              limit: 1,
              staleMs: STALE_MS,
              waitBudgetMs: WAIT_BUDGET_MS,
              pollMs: POLL_MS,
              isInteractive: false,
            },
          );
          return stderr.text().includes("ran past the 5s timeout");
        },
      )
      .extend("theEscalationOutlastedTheTimeout", async ({ slotDirectory, stampsDirectory }) => {
        const before = Date.now();
        await runThrottle(
          [
            "--timeout",
            "5",
            "--",
            "sh",
            "-c",
            `trap "" TERM; sleep 30 & echo $! > "${join(stampsDirectory, "grandchild-pid")}"; wait`,
          ],
          {
            slotDir: slotDirectory,
            limit: 1,
            staleMs: STALE_MS,
            waitBudgetMs: WAIT_BUDGET_MS,
            pollMs: POLL_MS,
            isInteractive: false,
          },
        );
        return Date.now() - before > 9500;
      })
      .extend("theProbeOfTheGrandchild", async ({ slotDirectory, stampsDirectory }) => {
        const pidFile = join(stampsDirectory, "grandchild-pid");
        await runThrottle(
          [
            "--timeout",
            "5",
            "--",
            "sh",
            "-c",
            `trap "" TERM; sleep 30 & echo $! > "${pidFile}"; wait`,
          ],
          {
            slotDir: slotDirectory,
            limit: 1,
            staleMs: STALE_MS,
            waitBudgetMs: WAIT_BUDGET_MS,
            pollMs: POLL_MS,
            isInteractive: false,
          },
        );
        await delay(200);
        try {
          process.kill(Number(readFileSync(pidFile, "utf8").trim()), 0);
          throw new Error("the grandchild was still alive after the timeout");
        } catch (probedGrandchild) {
          return probedGrandchild instanceof Error
            ? probedGrandchild.message
            : String(probedGrandchild);
        }
      });

    it("is reported as a failure", { timeout: 25_000 }, ({ theCodeOfAStubbornProcessTree }) => {
      expect(theCodeOfAStubbornProcessTree).toBe(1);
    });

    it(
      "names the timeout on stderr",
      { timeout: 25_000 },
      ({ theStubbornTimeoutIsNamedOnStderr }) => {
        expect(theStubbornTimeoutIsNamedOnStderr).toBe(true);
      },
    );

    it(
      "waits past the timeout before escalating to SIGKILL",
      { timeout: 25_000 },
      ({ theEscalationOutlastedTheTimeout }) => {
        expect(theEscalationOutlastedTheTimeout).toBe(true);
      },
    );

    it("leaves no grandchild behind", { timeout: 25_000 }, ({ theProbeOfTheGrandchild }) => {
      expect(theProbeOfTheGrandchild).toBe("kill ESRCH");
    });
  });

  describe("a run whose slot lease was compromised", () => {
    const it = throttleTest
      .extend("theCodeOfARunWhoseLeaseWasCompromised", async ({ slotDirectory }) => {
        const pendingRun = runThrottle(
          ["--", process.execPath, "-e", "setTimeout(() => {}, 2600);"],
          {
            slotDir: slotDirectory,
            limit: 1,
            staleMs: 2000,
            waitBudgetMs: WAIT_BUDGET_MS,
            pollMs: POLL_MS,
            isInteractive: false,
          },
        );
        await delay(500);
        rmSync(join(slotDirectory, "slot-0.lock"), { recursive: true, force: true });
        return pendingRun;
      })
      .extend("theCompromisedLeaseIsNamedOnStderr", async ({ slotDirectory, stderr }) => {
        const pendingRun = runThrottle(
          ["--", process.execPath, "-e", "setTimeout(() => {}, 2600);"],
          {
            slotDir: slotDirectory,
            limit: 1,
            staleMs: 2000,
            waitBudgetMs: WAIT_BUDGET_MS,
            pollMs: POLL_MS,
            isInteractive: false,
          },
        );
        await delay(500);
        rmSync(join(slotDirectory, "slot-0.lock"), { recursive: true, force: true });
        await pendingRun;
        return stderr.text().includes("slot lease compromised");
      });

    it(
      "leaves the running command alone",
      { timeout: 10_000 },
      ({ theCodeOfARunWhoseLeaseWasCompromised }) => {
        expect(theCodeOfARunWhoseLeaseWasCompromised).toBe(0);
      },
    );

    it("is reported on stderr", { timeout: 10_000 }, ({ theCompromisedLeaseIsNamedOnStderr }) => {
      expect(theCompromisedLeaseIsNamedOnStderr).toBe(true);
    });
  });

  describe("a hold that refuses to be released for a reason of its own", () => {
    const it = throttleTest.extend("theRefusalOfAnUnreleasableHold", async () => {
      try {
        return await runWithSlot(
          {
            timeoutSec: 0,
            executable: process.execPath,
            args: ["-e", ""],
            commandLine: `${process.execPath} -e `,
          },
          {
            release: () => Promise.reject(new Error("the lock store went away")),
          },
        );
      } catch (refused) {
        return refused instanceof Error ? refused.message : String(refused);
      }
    });

    it("hands the refusal on rather than reading it as a lease already given up", ({
      theRefusalOfAnUnreleasableHold,
    }) => {
      expect(theRefusalOfAnUnreleasableHold).toBe("the lock store went away");
    });
  });

  describe("everything a run of an unstartable command says", () => {
    const it = throttleTest.extend(
      "theRunOfAnUnstartableCommand",
      { auto: true },
      async ({ slotDirectory }) => {
        await runThrottle(["--", MISSING_EXECUTABLE], {
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          waitBudgetMs: WAIT_BUDGET_MS,
          pollMs: POLL_MS,
          isInteractive: false,
        });
      },
    );

    it("says nothing on stdout", { timeout: 30_000 }, ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });

    it("tells the whole run on stderr", { timeout: 30_000 }, ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [
            "throttle: acquiring a slot (limit 1)
        ",
            "throttle: run /no/such/executable-for-throttle
        ",
            "throttle: could not start /no/such/executable-for-throttle: spawn /no/such/executable-for-throttle ENOENT
        ",
          ],
        }
      `);
    });
  });
});
