import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, test } from "vite-plus/test";

import {
  ensureSlots,
  enqueueWaiter,
  removeWaiter,
  slotStateFingerprint,
  sweepWaiters,
  tryAcquireAny,
} from "./slots.ts";

const STALE_MS = 5000;

describe("ensureSlots", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
    onCleanup(() => {
      rmSync(temporarySlotDirectory, { recursive: true, force: true });
    });
    return temporarySlotDirectory;
  });

  describe("a directory ensured twice for three slots", () => {
    const it = slotTest
      .extend("firstSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return existsSync(join(slotDirectory, "slot-0"));
      })
      .extend("secondSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return existsSync(join(slotDirectory, "slot-1"));
      })
      .extend("thirdSlotMarkerAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return existsSync(join(slotDirectory, "slot-2"));
      })
      .extend("waitersDirectoryAfterEnsuringTwice", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 3);
        ensureSlots(slotDirectory, 3);
        return existsSync(join(slotDirectory, "waiters"));
      });

    it("creates the first slot marker", ({ firstSlotMarkerAfterEnsuringTwice }) => {
      expect(firstSlotMarkerAfterEnsuringTwice).toBe(true);
    });

    it("creates the second slot marker", ({ secondSlotMarkerAfterEnsuringTwice }) => {
      expect(secondSlotMarkerAfterEnsuringTwice).toBe(true);
    });

    it("creates the third slot marker", ({ thirdSlotMarkerAfterEnsuringTwice }) => {
      expect(thirdSlotMarkerAfterEnsuringTwice).toBe(true);
    });

    it("creates the waiters directory", ({ waitersDirectoryAfterEnsuringTwice }) => {
      expect(waitersDirectoryAfterEnsuringTwice).toBe(true);
    });
  });

  describe("a lock left behind by a killed holder as a plain file", () => {
    const it = slotTest
      .extend("theStrandedPlainFileLockAfterEnsuring", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        writeFileSync(join(slotDirectory, "slot-0.lock"), "");
        ensureSlots(slotDirectory, 1);
        return existsSync(join(slotDirectory, "slot-0.lock"));
      })
      .extend("aSlotHeldAfterEnsuringOverTheStrandedLock", async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        writeFileSync(join(slotDirectory, "slot-0.lock"), "");
        ensureSlots(slotDirectory, 1);
        const held = await tryAcquireAny({
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          onCompromised: (failure) => {
            throw failure;
          },
        });
        await held?.release();
        return held !== null;
      });

    it("discards the stranded lock", ({ theStrandedPlainFileLockAfterEnsuring }) => {
      expect(theStrandedPlainFileLockAfterEnsuring).toBe(false);
    });

    it("leaves the slot free to be taken", ({ aSlotHeldAfterEnsuringOverTheStrandedLock }) => {
      expect(aSlotHeldAfterEnsuringOverTheStrandedLock).toBe(true);
    });
  });

  describe("a slot ensured again while a live holder keeps it", () => {
    const it = slotTest.extend(
      "aRivalArrivingAfterEnsuringOverALiveHold",
      async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const held = await tryAcquireAny({
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          onCompromised: (failure) => {
            throw failure;
          },
        });
        ensureSlots(slotDirectory, 1);
        const rival = await tryAcquireAny({
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          onCompromised: (failure) => {
            throw failure;
          },
        });
        await held?.release();
        return rival;
      },
    );

    it("leaves the live hold standing", ({ aRivalArrivingAfterEnsuringOverALiveHold }) => {
      expect(aRivalArrivingAfterEnsuringOverALiveHold).toBe(null);
    });
  });

  describe("a lock path that stat cannot follow", () => {
    const it = slotTest.extend("theRefusalOfALockPointingAtItself", ({ slotDirectory }) => {
      ensureSlots(slotDirectory, 1);
      symlinkSync(join(slotDirectory, "slot-0.lock"), join(slotDirectory, "slot-0.lock"));
      try {
        ensureSlots(slotDirectory, 1);
      } catch (refused) {
        return refused instanceof Error ? refused.message.split(",")[0] : String(refused);
      }
      throw new Error("ensureSlots swallowed the lock it could not read");
    });

    it("hands the refusal on rather than discarding the lock", ({
      theRefusalOfALockPointingAtItself,
    }) => {
      expect(theRefusalOfALockPointingAtItself).toBe("ELOOP: too many symbolic links encountered");
    });
  });
});

describe("tryAcquireAny", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
    onCleanup(() => {
      rmSync(temporarySlotDirectory, { recursive: true, force: true });
    });
    return temporarySlotDirectory;
  });

  describe("the only slot standing free", () => {
    const it = slotTest.extend("aFirstAcquisitionHoldsASlot", async ({ slotDirectory }) => {
      ensureSlots(slotDirectory, 1);
      const held = await tryAcquireAny({
        slotDir: slotDirectory,
        limit: 1,
        staleMs: STALE_MS,
        onCompromised: (failure) => {
          throw failure;
        },
      });
      await held?.release();
      return held !== null;
    });

    it("hands back a slot", ({ aFirstAcquisitionHoldsASlot }) => {
      expect(aFirstAcquisitionHoldsASlot).toBe(true);
    });
  });

  describe("a rival arriving while the only slot is held", () => {
    const it = slotTest.extend("aSecondAcquisitionWhileHeld", async ({ slotDirectory }) => {
      ensureSlots(slotDirectory, 1);
      const held = await tryAcquireAny({
        slotDir: slotDirectory,
        limit: 1,
        staleMs: STALE_MS,
        onCompromised: (failure) => {
          throw failure;
        },
      });
      const rival = await tryAcquireAny({
        slotDir: slotDirectory,
        limit: 1,
        staleMs: STALE_MS,
        onCompromised: (failure) => {
          throw failure;
        },
      });
      await held?.release();
      return rival;
    });

    it("hands back nothing", ({ aSecondAcquisitionWhileHeld }) => {
      expect(aSecondAcquisitionWhileHeld).toBe(null);
    });
  });

  describe("the only slot after its holder released it", () => {
    const it = slotTest.extend("anAcquisitionAfterRelease", async ({ slotDirectory }) => {
      ensureSlots(slotDirectory, 1);
      const held = await tryAcquireAny({
        slotDir: slotDirectory,
        limit: 1,
        staleMs: STALE_MS,
        onCompromised: (failure) => {
          throw failure;
        },
      });
      await held?.release();
      const holdAfterRelease = await tryAcquireAny({
        slotDir: slotDirectory,
        limit: 1,
        staleMs: STALE_MS,
        onCompromised: (failure) => {
          throw failure;
        },
      });
      await holdAfterRelease?.release();
      return holdAfterRelease !== null;
    });

    it("hands back the slot again", ({ anAcquisitionAfterRelease }) => {
      expect(anAcquisitionAfterRelease).toBe(true);
    });
  });

  describe("a slot marker that is not on disk", () => {
    const it = slotTest.extend("theCodeOfTheFailureThatEscaped", async ({ slotDirectory }) => {
      ensureSlots(slotDirectory, 1);
      rmSync(join(slotDirectory, "slot-0"));
      try {
        await tryAcquireAny({
          slotDir: slotDirectory,
          limit: 1,
          staleMs: STALE_MS,
          onCompromised: (failure) => {
            throw failure;
          },
        });
      } catch (failure) {
        return failure instanceof Error ? failure.message.slice(0, 6) : String(failure);
      }
      throw new Error("tryAcquireAny swallowed the missing slot marker");
    });

    it("lets a failure other than contention escape untouched", ({
      theCodeOfTheFailureThatEscaped,
    }) => {
      expect(theCodeOfTheFailureThatEscaped).toBe("ENOENT");
    });
  });
});

describe("slotStateFingerprint", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
    onCleanup(() => {
      rmSync(temporarySlotDirectory, { recursive: true, force: true });
    });
    return temporarySlotDirectory;
  });

  describe("two slots standing free", () => {
    const it = test.extend("theFingerprintOfFreeSlots", ({}, { onCleanup }) => {
      const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
      onCleanup(() => {
        rmSync(temporarySlotDirectory, { recursive: true, force: true });
      });
      ensureSlots(temporarySlotDirectory, 2);
      return slotStateFingerprint(temporarySlotDirectory, 2);
    });

    it("names every free slot as free", ({ theFingerprintOfFreeSlots }) => {
      expect(theFingerprintOfFreeSlots).toBe("free,free");
    });
  });

  describe("one slot out of two taken", () => {
    const it = slotTest.extend(
      "theFingerprintChangesOnceASlotIsHeld",
      async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 2);
        const free = slotStateFingerprint(slotDirectory, 2);
        const held = await tryAcquireAny({
          slotDir: slotDirectory,
          limit: 2,
          staleMs: STALE_MS,
          onCompromised: (failure) => {
            throw failure;
          },
        });
        const taken = slotStateFingerprint(slotDirectory, 2);
        await held?.release();
        return taken !== free;
      },
    );

    it("changes once a slot is held", ({ theFingerprintChangesOnceASlotIsHeld }) => {
      expect(theFingerprintChangesOnceASlotIsHeld).toBe(true);
    });
  });

  describe("a slot locked, released and locked again", () => {
    const it = slotTest.extend(
      "theFingerprintChangesWhenTheLockIsCreatedAnew",
      async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 2);
        const first = await tryAcquireAny({
          slotDir: slotDirectory,
          limit: 2,
          staleMs: STALE_MS,
          onCompromised: (failure) => {
            throw failure;
          },
        });
        const held = slotStateFingerprint(slotDirectory, 2);
        await first?.release();
        const second = await tryAcquireAny({
          slotDir: slotDirectory,
          limit: 2,
          staleMs: STALE_MS,
          onCompromised: (failure) => {
            throw failure;
          },
        });
        const again = slotStateFingerprint(slotDirectory, 2);
        await second?.release();
        return again !== held;
      },
    );

    it("changes whenever a slot's lock is created anew", ({
      theFingerprintChangesWhenTheLockIsCreatedAnew,
    }) => {
      expect(theFingerprintChangesWhenTheLockIsCreatedAnew).toBe(true);
    });
  });
});

describe("sweepWaiters", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
    onCleanup(() => {
      rmSync(temporarySlotDirectory, { recursive: true, force: true });
    });
    return temporarySlotDirectory;
  });

  describe("a queue holding this process's entry beside four planted ones", () => {
    const it = slotTest
      .extend("theSurvivorsBesideTheOwnWaiterEntry", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = join(slotDirectory, "waiters");
        enqueueWaiter(slotDirectory);
        writeFileSync(join(waiters, "0000000000001-broken-aaaaaaaa"), "not a pid\n");
        mkdirSync(join(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileSync(
          join(waiters, "0000000000003-dead-cccccccc"),
          `${String(spawnSync(process.execPath, ["-e", ""]).pid)}\n`,
        );
        writeFileSync(join(waiters, "0000000000004-root-dddddddd"), "1\n");
        return sweepWaiters(slotDirectory).slice(0, 1);
      })
      .extend("theOwnWaiterEntryIsTheLastSurvivor", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = join(slotDirectory, "waiters");
        const ownEntry = enqueueWaiter(slotDirectory);
        writeFileSync(join(waiters, "0000000000001-broken-aaaaaaaa"), "not a pid\n");
        mkdirSync(join(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileSync(
          join(waiters, "0000000000003-dead-cccccccc"),
          `${String(spawnSync(process.execPath, ["-e", ""]).pid)}\n`,
        );
        writeFileSync(join(waiters, "0000000000004-root-dddddddd"), "1\n");
        return sweepWaiters(slotDirectory).at(-1) === basename(ownEntry);
      })
      .extend("theWaitersLeftOnDiskThatSweepingDidNotKeep", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = join(slotDirectory, "waiters");
        enqueueWaiter(slotDirectory);
        writeFileSync(join(waiters, "0000000000001-broken-aaaaaaaa"), "not a pid\n");
        mkdirSync(join(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileSync(
          join(waiters, "0000000000003-dead-cccccccc"),
          `${String(spawnSync(process.execPath, ["-e", ""]).pid)}\n`,
        );
        writeFileSync(join(waiters, "0000000000004-root-dddddddd"), "1\n");
        const survivors = sweepWaiters(slotDirectory);
        return readdirSync(waiters).filter((waiterFilename) => !survivors.includes(waiterFilename));
      })
      .extend("theSurvivorsSweepingKeptThatAreGoneFromDisk", ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const waiters = join(slotDirectory, "waiters");
        enqueueWaiter(slotDirectory);
        writeFileSync(join(waiters, "0000000000001-broken-aaaaaaaa"), "not a pid\n");
        mkdirSync(join(waiters, "0000000000002-unreadable-bbbbbbbb"));
        writeFileSync(
          join(waiters, "0000000000003-dead-cccccccc"),
          `${String(spawnSync(process.execPath, ["-e", ""]).pid)}\n`,
        );
        writeFileSync(join(waiters, "0000000000004-root-dddddddd"), "1\n");
        const survivors = sweepWaiters(slotDirectory);
        return survivors.filter(
          (survivingWaiterFilename) => !readdirSync(waiters).includes(survivingWaiterFilename),
        );
      });

    it("keeps the live entries in name order", ({ theSurvivorsBesideTheOwnWaiterEntry }) => {
      expect(theSurvivorsBesideTheOwnWaiterEntry).toStrictEqual(["0000000000004-root-dddddddd"]);
    });

    it("keeps the entry this process enqueued", ({ theOwnWaiterEntryIsTheLastSurvivor }) => {
      expect(theOwnWaiterEntryIsTheLastSurvivor).toBe(true);
    });

    it("deletes every entry it did not keep", ({ theWaitersLeftOnDiskThatSweepingDidNotKeep }) => {
      expect(theWaitersLeftOnDiskThatSweepingDidNotKeep).toStrictEqual([]);
    });

    it("leaves every entry it kept on disk", ({ theSurvivorsSweepingKeptThatAreGoneFromDisk }) => {
      expect(theSurvivorsSweepingKeptThatAreGoneFromDisk).toStrictEqual([]);
    });
  });
});

describe("removeWaiter", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
    onCleanup(() => {
      rmSync(temporarySlotDirectory, { recursive: true, force: true });
    });
    return temporarySlotDirectory;
  });

  describe("an entry removed twice", () => {
    const it = slotTest.extend("theWaitersLeftAfterRemovingTwice", ({ slotDirectory }) => {
      ensureSlots(slotDirectory, 1);
      const waiterEntry = enqueueWaiter(slotDirectory);
      removeWaiter(waiterEntry);
      removeWaiter(waiterEntry);
      return readdirSync(join(slotDirectory, "waiters"));
    });

    it("tolerates an entry that is already gone", ({ theWaitersLeftAfterRemovingTwice }) => {
      expect(theWaitersLeftAfterRemovingTwice).toStrictEqual([]);
    });
  });
});

describe("enqueueWaiter", () => {
  const slotTest = test.extend("slotDirectory", ({}, { onCleanup }) => {
    const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
    onCleanup(() => {
      rmSync(temporarySlotDirectory, { recursive: true, force: true });
    });
    return temporarySlotDirectory;
  });

  describe("two entries enqueued in turn", () => {
    const it = slotTest.extend(
      "theSurvivorsOfTwoWaitersEnqueuedInTurn",
      async ({ slotDirectory }) => {
        ensureSlots(slotDirectory, 1);
        const first = enqueueWaiter(slotDirectory);
        await delay(5);
        const second = enqueueWaiter(slotDirectory);
        return (
          sweepWaiters(slotDirectory).join("\n") ===
          [first, second].map((enqueuedWaiter) => basename(enqueuedWaiter)).join("\n")
        );
      },
    );

    it("names them so they sort by creation order", ({
      theSurvivorsOfTwoWaitersEnqueuedInTurn,
    }) => {
      expect(theSurvivorsOfTwoWaitersEnqueuedInTurn).toBe(true);
    });
  });
});

describe("a slot directory this process may not read", () => {
  describe("a fingerprint read off a directory closed to this process", () => {
    const it = test.extend("theRefusalOfAClosedSlotDirectory", ({}, { onCleanup }) => {
      const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
      onCleanup(() => {
        chmodSync(temporarySlotDirectory, 0o700);
        rmSync(temporarySlotDirectory, { recursive: true, force: true });
      });
      ensureSlots(temporarySlotDirectory, 1);
      chmodSync(temporarySlotDirectory, 0o000);
      try {
        return slotStateFingerprint(temporarySlotDirectory, 1);
      } catch (refused) {
        return refused instanceof Error ? refused.message.split(",")[0] : String(refused);
      }
    });

    it("hands the refusal on rather than reading it as a free slot", ({
      theRefusalOfAClosedSlotDirectory,
    }) => {
      expect(theRefusalOfAClosedSlotDirectory).toBe("EACCES: permission denied");
    });
  });

  describe("a sweep over an entry closed to this process", () => {
    const it = test.extend("theRefusalOfAClosedWaiterEntry", ({}, { onCleanup }) => {
      const temporarySlotDirectory = mkdtempSync(join(tmpdir(), "throttle-slots-"));
      onCleanup(() => {
        chmodSync(temporarySlotDirectory, 0o700);
        rmSync(temporarySlotDirectory, { recursive: true, force: true });
      });
      ensureSlots(temporarySlotDirectory, 1);
      chmodSync(enqueueWaiter(temporarySlotDirectory), 0o000);
      try {
        return sweepWaiters(temporarySlotDirectory);
      } catch (refused) {
        return refused instanceof Error ? refused.message.split(",")[0] : String(refused);
      }
    });

    it("hands the refusal on rather than reading it as an entry with no owner", ({
      theRefusalOfAClosedWaiterEntry,
    }) => {
      expect(theRefusalOfAClosedWaiterEntry).toBe("EACCES: permission denied");
    });
  });
});
