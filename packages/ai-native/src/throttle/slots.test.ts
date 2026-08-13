import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
  staleMs: 5000,
  onCompromised: (failure) => {
    throw failure;
  },
});

const exitedPid = (): number => {
  const child = spawnSync(process.execPath, ["-e", ""]);
  return child.pid;
};

describe("slots", () => {
  test("ensureSlots creates one marker per slot and the waiters directory, idempotently", () => {
    const directory = slotDirectory();

    ensureSlots(directory, 3);
    ensureSlots(directory, 3);

    expect(existsSync(join(directory, "slot-0"))).toBe(true);
    expect(existsSync(join(directory, "slot-1"))).toBe(true);
    expect(existsSync(join(directory, "slot-2"))).toBe(true);
    expect(existsSync(join(directory, "waiters"))).toBe(true);
  });

  test("tryAcquireAny holds a slot exclusively and frees it on release", async () => {
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

  test("tryAcquireAny lets a failure other than contention escape untouched", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    rmSync(join(directory, "slot-0"));

    await expect(tryAcquireAny(acquisition(directory))).rejects.toThrow(/ENOENT/);
  });

  test("ensureSlots discards a lock left behind as a file instead of a directory", () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    writeFileSync(join(directory, "slot-0.lock"), "");

    ensureSlots(directory, 1);

    expect(existsSync(join(directory, "slot-0.lock"))).toBe(false);
  });

  test("ensureSlots keeps the lock directory a running holder created", () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    mkdirSync(join(directory, "slot-0.lock"));

    ensureSlots(directory, 1);

    expect(existsSync(join(directory, "slot-0.lock"))).toBe(true);
  });

  test("a slot polluted by a file named like a lock is takeable again", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    writeFileSync(join(directory, "slot-0.lock"), "");

    ensureSlots(directory, 1);
    const hold = await tryAcquireAny(acquisition(directory));

    expect(hold).not.toBeNull();
    await hold?.release();
  });

  test("slotStateFingerprint changes whenever a slot's lock is created anew", async () => {
    const directory = slotDirectory();
    ensureSlots(directory, 2);

    const free = slotStateFingerprint(directory, 2);
    expect(free).toBe("free,free");

    const first = await tryAcquireAny(acquisition(directory, 2));
    const held = slotStateFingerprint(directory, 2);
    expect(held).not.toBe(free);

    await first?.release();
    const second = await tryAcquireAny(acquisition(directory, 2));
    expect(slotStateFingerprint(directory, 2)).not.toBe(held);
    await second?.release();
  });

  test("sweepWaiters keeps live entries in name order and deletes the rest", () => {
    const directory = slotDirectory();
    ensureSlots(directory, 1);
    const waiters = join(directory, "waiters");
    const ownEntry = enqueueWaiter(directory);
    writeFileSync(join(waiters, "0000000000001-broken-aaaaaaaa"), "not a pid\n");
    mkdirSync(join(waiters, "0000000000002-unreadable-bbbbbbbb"));
    writeFileSync(join(waiters, "0000000000003-dead-cccccccc"), `${exitedPid()}\n`);
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
