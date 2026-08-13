import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { lock } from "proper-lockfile";
import { describe, expect, test } from "vite-plus/test";

import { ensureSlots } from "./slots.ts";

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

const TWO_STREAM_SCRIPT =
  "process.stdout.write('alpha\\nbeta\\n'); process.stderr.write('gamma\\ndelta\\n');";

describe("cli", () => {
  describe("a call that names no command", () => {
    const it = test.extend("theWayThrottleAnswersACallWithoutACommand", async ({}, {
      onCleanup,
    }) => {
      const tmpRoot = mkdtempSync(join(tmpdir(), "throttle-cli-tmp-"));
      onCleanup(() => {
        rmSync(tmpRoot, { recursive: true, force: true });
      });
      const child = spawn(process.execPath, [CLI_PATH], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TMPDIR: tmpRoot },
      });
      return Promise.all([once(child, "exit"), text(child.stdout), text(child.stderr)]);
    });

    it(
      "exits 2 with nothing on stdout and the usage on stderr",
      { timeout: 20_000 },
      ({ theWayThrottleAnswersACallWithoutACommand }) => {
        expect(theWayThrottleAnswersACallWithoutACommand).toMatchInlineSnapshot(`
          [
            [
              2,
              null,
            ],
            "",
            "Usage: throttle [--timeout <seconds>] -- <command> [args...]

          Runs the command while keeping the number of simultaneous executions that
          share this host and namespace at or below the limit. When every slot is held
          the wrapper joins a wait queue, reports its position on stderr, and retries
          every slot on each poll, for at most the wait budget. A slot whose holder
          died without releasing is reclaimed once the holder's liveness mark goes
          stale. Do not nest throttle inside a command it wraps: the inner call counts
          as one more competitor and consumes a second slot.

          Options:
            --timeout <seconds>  Send SIGTERM to the command's process group after this
                                 many seconds, then SIGKILL after a short grace period.
                                 0 never interrupts the command. Defaults to 0.

          Environment:
            MST_THROTTLE_LIMIT   Number of slots shared by every throttle on this host
                                 and namespace. Invalid values (non-integer, zero or
                                 less) fall back to the default of 1.

          Exit codes:
            0  the wrapped command succeeded
            1  the wrapped command failed, was killed, could not be started, ran past
               the timeout, or the wrapper could not get a slot
            2  throttle itself was called incorrectly
          ",
          ]
        `);
      },
    );
  });

  describe("a command that writes to both of its streams", () => {
    describe("started without the wrapper", () => {
      const it = test.extend("theWayNodeRunsItOnItsOwn", async () => {
        const child = spawn(process.execPath, ["-e", TWO_STREAM_SCRIPT], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        return Promise.all([once(child, "exit"), text(child.stdout), text(child.stderr)]);
      });

      it(
        "exits zero after writing two lines to each stream",
        { timeout: 30_000 },
        ({ theWayNodeRunsItOnItsOwn }) => {
          expect(theWayNodeRunsItOnItsOwn).toStrictEqual([
            [0, null],
            "alpha\nbeta\n",
            "gamma\ndelta\n",
          ]);
        },
      );
    });

    describe("started through the wrapper", () => {
      const it = test.extend("theWayThrottleRunsIt", async ({}, { onCleanup }) => {
        const tmpRoot = mkdtempSync(join(tmpdir(), "throttle-cli-tmp-"));
        onCleanup(() => {
          rmSync(tmpRoot, { recursive: true, force: true });
        });
        const child = spawn(
          process.execPath,
          [CLI_PATH, "--", process.execPath, "-e", TWO_STREAM_SCRIPT],
          {
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env, TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
          },
        );
        return Promise.all([once(child, "exit"), text(child.stdout), text(child.stderr)]);
      });

      it(
        "hands both streams through byte for byte and adds only its own lines to stderr",
        { timeout: 30_000 },
        ({ theWayThrottleRunsIt }) => {
          expect(theWayThrottleRunsIt).toStrictEqual([
            [0, null],
            "alpha\nbeta\n",
            `throttle: acquiring a slot (limit 1)\nthrottle: run ${process.execPath} -e ${TWO_STREAM_SCRIPT}\ngamma\ndelta\n`,
          ]);
        },
      );
    });
  });

  describe("a wrapper left waiting because the only slot is held", () => {
    describe("when a SIGTERM reaches it", () => {
      const it = test.extend("theWayAWaitingWrapperEnds", async ({}, { onCleanup }) => {
        const tmpRoot = mkdtempSync(join(tmpdir(), "throttle-cli-tmp-"));
        const slotDir = join(tmpRoot, "mst-throttle", "mst");
        ensureSlots(slotDir, 1);
        const release = await lock(join(slotDir, "slot-0"), { stale: 60_000, retries: 0 });
        onCleanup(async () => {
          await release();
          rmSync(tmpRoot, { recursive: true, force: true });
        });
        const child = spawn(process.execPath, [CLI_PATH, "--", process.execPath, "-e", ""], {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
        });
        const waitersDir = join(slotDir, "waiters");
        const ownEntries = (): string[] =>
          readdirSync(waitersDir).filter((waiterFileName) =>
            waiterFileName.includes(`-${String(child.pid)}-`),
          );
        const untilEnqueued = async (): Promise<void> => {
          if (ownEntries().length === 1) return;
          await delay(100);
          return untilEnqueued();
        };
        await untilEnqueued();
        child.kill("SIGTERM");
        return Promise.all([once(child, "exit"), text(child.stdout)]);
      });

      it(
        "dies of the signal it was sent, having written nothing to stdout",
        { timeout: 30_000 },
        ({ theWayAWaitingWrapperEnds }) => {
          expect(theWayAWaitingWrapperEnds).toStrictEqual([[null, "SIGTERM"], ""]);
        },
      );
    });

    describe("once a SIGTERM has ended it", () => {
      const it = test.extend("theQueueEntriesOfAKilledWrapper", async ({}, { onCleanup }) => {
        const tmpRoot = mkdtempSync(join(tmpdir(), "throttle-cli-tmp-"));
        const slotDir = join(tmpRoot, "mst-throttle", "mst");
        ensureSlots(slotDir, 1);
        const release = await lock(join(slotDir, "slot-0"), { stale: 60_000, retries: 0 });
        onCleanup(async () => {
          await release();
          rmSync(tmpRoot, { recursive: true, force: true });
        });
        const child = spawn(process.execPath, [CLI_PATH, "--", process.execPath, "-e", ""], {
          stdio: ["ignore", "pipe", "pipe"],
          env: { ...process.env, TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "1" },
        });
        const waitersDir = join(slotDir, "waiters");
        const ownEntries = (): string[] =>
          readdirSync(waitersDir).filter((waiterFileName) =>
            waiterFileName.includes(`-${String(child.pid)}-`),
          );
        const untilEnqueued = async (): Promise<void> => {
          if (ownEntries().length === 1) return;
          await delay(100);
          return untilEnqueued();
        };
        await untilEnqueued();
        child.kill("SIGTERM");
        await once(child, "exit");
        const untilDrained = async (pollsLeft: number): Promise<void> => {
          if (pollsLeft === 0 || ownEntries().length === 0) return;
          await delay(100);
          return untilDrained(pollsLeft - 1);
        };
        await untilDrained(100);
        return ownEntries();
      });

      it(
        "has taken its own entry out of the wait queue",
        { timeout: 30_000 },
        ({ theQueueEntriesOfAKilledWrapper }) => {
          expect(theQueueEntriesOfAKilledWrapper).toStrictEqual([]);
        },
      );
    });
  });
});
