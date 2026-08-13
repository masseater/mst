import { spawn, type ChildProcess } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import {
  ensureSlots,
  enqueueWaiter,
  removeWaiter,
  slotStateFingerprint,
  sweepWaiters,
  tryAcquireAny,
  type AcquireConfiguration,
} from "./slots.ts";

import type { Readable } from "node:stream";

const slotDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
  onTestFinished(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
};

const acquisition = (slotDir: string, limit = 1): AcquireConfiguration => ({
  slotDir,
  limit,
});

const EXITED_PID = 999_999_999;

const failureCodeFrom = (operation: () => void): string => {
  try {
    operation();
    return "no-failure";
  } catch (operationFailure) {
    return (operationFailure as NodeJS.ErrnoException).code ?? "unknown";
  }
};

const firstOutputFrom = (readable: Readable): Promise<string> =>
  new Promise((resolve) => {
    readable.once("data", (emission: Buffer | string) => {
      resolve(String(emission));
    });
  });

const childExit = (holder: ChildProcess): Promise<void> =>
  new Promise((resolve) => {
    holder.once("exit", () => {
      resolve();
    });
  });

describe("slots", () => {
  test("ensureSlots creates one marker per slot and the waiters directory, idempotently", () => {
    const directory = slotDirectory();

    ensureSlots(directory, 3);
    ensureSlots(directory, 3);

    expect(existsSync(join(directory, "slot-0"))).toBe(true);
    expect(existsSync(join(directory, "slot-1"))).toBe(true);
    expect(existsSync(join(directory, "slot-2"))).toBe(true);
    expect(existsSync(join(directory, "slot-0.lock"))).toBe(true);
    expect(existsSync(join(directory, "slot-1.lock"))).toBe(true);
    expect(existsSync(join(directory, "slot-2.lock"))).toBe(true);
    expect(statSync(join(directory, "slot-0.lock")).isFile()).toBe(true);
    expect(statSync(join(directory, "slot-1.lock")).isFile()).toBe(true);
    expect(statSync(join(directory, "slot-2.lock")).isFile()).toBe(true);
    expect(existsSync(join(directory, "waiters"))).toBe(true);
  });

  test("native lock holds a slot exclusively and frees it on release", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);

    const first = await tryAcquireAny(acquisition(directory));
    expect(first).not.toBeNull();
    expect(await tryAcquireAny(acquisition(directory))).toBeNull();

    await first?.release();

    const second = await tryAcquireAny(acquisition(directory));
    expect(second).not.toBeNull();
    await second?.release();
  });

  test("release is shared by concurrent and repeated callers without closing a reused fd", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    const hold = await tryAcquireAny(acquisition(directory));
    expect(hold).not.toBeNull();

    const firstRelease = hold?.release();
    const concurrentRelease = hold?.release();
    expect(concurrentRelease).toBe(firstRelease);
    await Promise.all([firstRelease, concurrentRelease]);

    const unrelatedDescriptor = openSync(join(directory, "unrelated"), "w");
    await hold?.release();
    expect(writeSync(unrelatedDescriptor, "still-open")).toBe(10);
    closeSync(unrelatedDescriptor);
  });

  test("an old lock directory blocks initialization until the old holder is drained", async () => {
    const directory = slotDirectory();
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, "slot-0"), "");
    mkdirSync(join(directory, "slot-0.lock"));

    expect(["EACCES", "EISDIR", "EPERM"]).toContain(
      failureCodeFrom(() => {
        ensureSlots(directory, 1);
      }),
    );

    rmSync(join(directory, "slot-0.lock"), { recursive: true });
    ensureSlots(directory, 1);
    const acquired = await tryAcquireAny(acquisition(directory));
    expect(acquired).not.toBeNull();
    await acquired?.release();
  });

  test("a new lock file prevents the old directory protocol from acquiring or reclaiming", () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    const path = join(directory, "slot-0.lock");

    expect(
      failureCodeFrom(() => {
        mkdirSync(path);
      }),
    ).toBe("EEXIST");
    expect(["ENOTDIR", "EPERM"]).toContain(
      failureCodeFrom(() => {
        rmdirSync(path);
      }),
    );
  });

  test("tryAcquireAny releases the lock when recording its generation fails", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    rmSync(join(directory, "slot-0"));
    mkdirSync(join(directory, "slot-0"));

    await expect(tryAcquireAny(acquisition(directory))).rejects.toThrow(/directory|EISDIR|EPERM/i);

    rmSync(join(directory, "slot-0"), { recursive: true });
    writeFileSync(join(directory, "slot-0"), "");
    const acquired = await tryAcquireAny(acquisition(directory));
    expect(acquired).not.toBeNull();
    await acquired?.release();
  });

  test("slotStateFingerprint changes on each acquisition and remains stable after release", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 2);

    const free = slotStateFingerprint(directory, 2);
    expect(free).toBe("unused,unused");

    const first = await tryAcquireAny(acquisition(directory, 2));
    const held = slotStateFingerprint(directory, 2);
    expect(held).not.toBe(free);
    const firstGeneration = readFileSync(join(directory, "slot-0"), "utf8");

    await first?.release();
    expect(slotStateFingerprint(directory, 2)).toBe(held);
    const second = await tryAcquireAny(acquisition(directory, 2));
    expect(slotStateFingerprint(directory, 2)).not.toBe(held);
    expect(readFileSync(join(directory, "slot-0"), "utf8")).not.toBe(firstGeneration);
    await second?.release();
  });

  test("slotStateFingerprint names an unreadable generation", () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    rmSync(join(directory, "slot-0"));

    expect(slotStateFingerprint(directory, 1)).toBe("unreadable:ENOENT");
  });

  test(
    "native lock releases a crashed process slot for another process",
    { timeout: 30_000 },
    async () => {
      const directory = slotDirectory();
      const moduleUrl = new URL("./slots.ts", import.meta.url).href;
      const holderSource = [
        "const { ensureSlots, tryAcquireAny } = await import(process.argv[1]);",
        "const slotDir = process.argv[2];",
        "ensureSlots(slotDir, 1);",
        "const hold = await tryAcquireAny({ slotDir, limit: 1 });",
        'if (hold === null) throw new Error("expected to acquire the slot");',
        'process.stdout.write("ready");',
        "setInterval(() => void hold, 1000);",
      ].join(" ");
      const holder = spawn(process.execPath, ["-e", holderSource, moduleUrl, directory], {
        stdio: ["ignore", "pipe", "inherit"],
      });
      onTestFinished(() => {
        if (holder.exitCode === null && holder.signalCode === null) holder.kill("SIGKILL");
      });
      const exited = childExit(holder);
      const ready = await firstOutputFrom(holder.stdout);

      expect(ready).toBe("ready");
      expect(await tryAcquireAny(acquisition(directory))).toBeNull();

      holder.kill("SIGKILL");
      await exited;
      const replacement = await tryAcquireAny(acquisition(directory));

      expect(replacement).not.toBeNull();
      await replacement?.release();
    },
  );

  test("sweepWaiters keeps live entries in name order and deletes the rest", () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    const waiters = join(directory, "waiters");
    const ownEntry = enqueueWaiter(directory);
    writeFileSync(join(waiters, "0000000000001-broken-aaaaaaaa"), "not a pid\n");
    mkdirSync(join(waiters, "0000000000002-unreadable-bbbbbbbb"));
    writeFileSync(join(waiters, "0000000000003-dead-cccccccc"), `${EXITED_PID}\n`);
    writeFileSync(join(waiters, "0000000000004-root-dddddddd"), "1\n");

    const survivors = sweepWaiters(directory);

    expect(survivors).toStrictEqual(["0000000000004-root-dddddddd", basename(ownEntry)]);
    expect(readdirSync(waiters).toSorted()).toStrictEqual(survivors);
  });

  test("removeWaiter tolerates an entry that is already gone", () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    const listed = enqueueWaiter(directory);

    removeWaiter(listed);
    removeWaiter(listed);

    expect(readdirSync(join(directory, "waiters"))).toStrictEqual([]);
  });

  test("waiter entries sort by creation order", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    const first = enqueueWaiter(directory);
    await delay(5);
    const second = enqueueWaiter(directory);

    const survivors = sweepWaiters(directory);

    expect(survivors).toStrictEqual([basename(first), basename(second)]);
  });
});
