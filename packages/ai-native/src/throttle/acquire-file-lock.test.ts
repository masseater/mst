import { attempt, attemptAsync } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import { tryAcquireFileLock } from "./acquire-file-lock.ts";

describe("tryAcquireFileLock", () => {
  describe("a lock another holder already took", () => {
    const it = test
      .extend("theHoldOnALockAnotherHolderTook", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => false);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        return tryAcquireFileLock(fileLock);
      })
      .extend("theCloseCallForALockAnotherHolderTook", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => false);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        tryAcquireFileLock(fileLock);
        return close;
      })
      .extend("theGenerationRecordForALockAnotherHolderTook", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => false);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        tryAcquireFileLock(fileLock);
        return recordGeneration;
      });

    it("hands back no hold", ({ theHoldOnALockAnotherHolderTook }) => {
      expect(theHoldOnALockAnotherHolderTook).toBe(null);
    });

    it("closes the descriptor it opened once", ({ theCloseCallForALockAnotherHolderTook }) => {
      expect(theCloseCallForALockAnotherHolderTook).toHaveBeenCalledExactlyOnceWith(17);
    });

    it("records no generation", ({ theGenerationRecordForALockAnotherHolderTook }) => {
      expect(theGenerationRecordForALockAnotherHolderTook).toHaveBeenCalledTimes(0);
    });
  });

  describe("a taken lock whose descriptor refuses to close", () => {
    const closeFailure = new Error("close failed");
    const it = test
      .extend("theFailureFromATakenLockWhoseDescriptorRefusesToClose", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => false);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => {
          throw closeFailure;
        });
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        return acquisitionFailure;
      })
      .extend("theCloseCallForATakenLockWhoseDescriptorRefusesToClose", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => false);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => {
          throw closeFailure;
        });
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (acquisitionFailure === null) throw new Error("the acquisition did not fail");
        return close;
      })
      .extend("theGenerationRecordForATakenLockWhoseDescriptorRefusesToClose", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => false);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => {
          throw closeFailure;
        });
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (acquisitionFailure === null) throw new Error("the acquisition did not fail");
        return recordGeneration;
      });

    it("hands the close failure on", ({
      theFailureFromATakenLockWhoseDescriptorRefusesToClose,
    }) => {
      expect(theFailureFromATakenLockWhoseDescriptorRefusesToClose).toBe(closeFailure);
    });

    it("asks the descriptor to close once", ({
      theCloseCallForATakenLockWhoseDescriptorRefusesToClose,
    }) => {
      expect(
        theCloseCallForATakenLockWhoseDescriptorRefusesToClose,
      ).toHaveBeenCalledExactlyOnceWith(17);
    });

    it("records no generation", ({
      theGenerationRecordForATakenLockWhoseDescriptorRefusesToClose,
    }) => {
      expect(theGenerationRecordForATakenLockWhoseDescriptorRefusesToClose).toHaveBeenCalledTimes(
        0,
      );
    });
  });

  describe("a lock attempt that fails", () => {
    const lockFailure = new Error("lock failed");
    const it = test
      .extend("theFailureFromALockAttemptThatFails", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => {
          throw lockFailure;
        });
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        return acquisitionFailure;
      })
      .extend("theCloseCallForALockAttemptThatFails", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => {
          throw lockFailure;
        });
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (acquisitionFailure === null) throw new Error("the acquisition did not fail");
        return close;
      });

    it("hands the lock failure on", ({ theFailureFromALockAttemptThatFails }) => {
      expect(theFailureFromALockAttemptThatFails).toBe(lockFailure);
    });

    it("closes the descriptor it opened once", ({ theCloseCallForALockAttemptThatFails }) => {
      expect(theCloseCallForALockAttemptThatFails).toHaveBeenCalledExactlyOnceWith(17);
    });
  });

  describe("a lock attempt that fails while its descriptor refuses to close", () => {
    const lockFailure = new Error("lock failed");
    const closeFailure = new Error("close failed");
    const it = test
      .extend("theLockFailureGatheredFirstWhenTheCloseAlsoFails", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => {
          throw lockFailure;
        });
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => {
          throw closeFailure;
        });
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (!(acquisitionFailure instanceof AggregateError)) throw new Error("nothing gathered");
        return acquisitionFailure.errors.at(0) === lockFailure;
      })
      .extend("theCloseFailureGatheredSecondWhenTheLockAlsoFails", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => {
          throw lockFailure;
        });
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => {
          throw closeFailure;
        });
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (!(acquisitionFailure instanceof AggregateError)) throw new Error("nothing gathered");
        return acquisitionFailure.errors.at(1) === closeFailure;
      });

    it("gathers the lock failure first", ({ theLockFailureGatheredFirstWhenTheCloseAlsoFails }) => {
      expect(theLockFailureGatheredFirstWhenTheCloseAlsoFails).toBe(true);
    });

    it("gathers the close failure second", ({
      theCloseFailureGatheredSecondWhenTheLockAlsoFails,
    }) => {
      expect(theCloseFailureGatheredSecondWhenTheLockAlsoFails).toBe(true);
    });
  });

  describe("a lock this caller took", () => {
    const it = test
      .extend("theHoldOnALockThisCallerTook", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        return tryAcquireFileLock(fileLock);
      })
      .extend("theGenerationRecordForALockThisCallerTook", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        tryAcquireFileLock(fileLock);
        return recordGeneration;
      })
      .extend("theReleaseOfALockThisCallerTookIsShared", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        const firstRelease = hold?.release();
        const secondRelease = hold?.release();
        await Promise.all([firstRelease, secondRelease]);
        return firstRelease === secondRelease;
      })
      .extend("theUnlockCallAfterReleasingALockThisCallerTook", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        await hold?.release();
        return unlock;
      })
      .extend("theCloseCallAfterReleasingALockThisCallerTook", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        await hold?.release();
        return close;
      });

    it("hands back a hold", ({ theHoldOnALockThisCallerTook }) => {
      expect(theHoldOnALockThisCallerTook).not.toBe(null);
    });

    it("records the generation once", ({ theGenerationRecordForALockThisCallerTook }) => {
      expect(theGenerationRecordForALockThisCallerTook).toHaveBeenCalledOnce();
    });

    it("hands every caller the same release", ({ theReleaseOfALockThisCallerTookIsShared }) => {
      expect(theReleaseOfALockThisCallerTookIsShared).toBe(true);
    });

    it("unlocks the descriptor once", ({ theUnlockCallAfterReleasingALockThisCallerTook }) => {
      expect(theUnlockCallAfterReleasingALockThisCallerTook).toHaveBeenCalledExactlyOnceWith(17);
    });

    it("closes the descriptor once", ({ theCloseCallAfterReleasingALockThisCallerTook }) => {
      expect(theCloseCallAfterReleasingALockThisCallerTook).toHaveBeenCalledExactlyOnceWith(17);
    });
  });

  describe("a hold whose unlock fails", () => {
    const releaseFailure = new Error("unlock failed");
    const it = test
      .extend("theReleaseOfAHoldWhoseUnlockFailsIsShared", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => {
          throw releaseFailure;
        });
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        const firstRelease = hold?.release();
        const secondRelease = hold?.release();
        await Promise.allSettled([firstRelease, secondRelease]);
        return firstRelease === secondRelease;
      })
      .extend("theFailureFromTheFirstReleaseOfAHoldWhoseUnlockFails", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => {
          throw releaseFailure;
        });
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        const [firstReleaseFailure] = await attemptAsync(async () => hold?.release());
        return firstReleaseFailure;
      })
      .extend("theFailureFromTheSecondReleaseOfAHoldWhoseUnlockFails", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => {
          throw releaseFailure;
        });
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        const [firstReleaseFailure] = await attemptAsync(async () => hold?.release());
        if (firstReleaseFailure === null) throw new Error("the first release did not fail");
        const [secondReleaseFailure] = await attemptAsync(async () => hold?.release());
        return secondReleaseFailure;
      })
      .extend("theUnlockCallOfAHoldWhoseUnlockFails", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => {
          throw releaseFailure;
        });
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        const [firstReleaseFailure] = await attemptAsync(async () => hold?.release());
        if (firstReleaseFailure === null) throw new Error("the release did not fail");
        return unlock;
      })
      .extend("theCloseCallOfAHoldWhoseUnlockFails", async () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => {
          throw releaseFailure;
        });
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => undefined);
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const hold = tryAcquireFileLock(fileLock);
        const [firstReleaseFailure] = await attemptAsync(async () => hold?.release());
        if (firstReleaseFailure === null) throw new Error("the release did not fail");
        return close;
      });

    it("hands every caller the same release", ({ theReleaseOfAHoldWhoseUnlockFailsIsShared }) => {
      expect(theReleaseOfAHoldWhoseUnlockFailsIsShared).toBe(true);
    });

    it("fails the first release with the unlock failure", ({
      theFailureFromTheFirstReleaseOfAHoldWhoseUnlockFails,
    }) => {
      expect(theFailureFromTheFirstReleaseOfAHoldWhoseUnlockFails).toBe(releaseFailure);
    });

    it("fails the second release with the same unlock failure", ({
      theFailureFromTheSecondReleaseOfAHoldWhoseUnlockFails,
    }) => {
      expect(theFailureFromTheSecondReleaseOfAHoldWhoseUnlockFails).toBe(releaseFailure);
    });

    it("asks the descriptor to unlock once", ({ theUnlockCallOfAHoldWhoseUnlockFails }) => {
      expect(theUnlockCallOfAHoldWhoseUnlockFails).toHaveBeenCalledExactlyOnceWith(17);
    });

    it("closes the descriptor once", ({ theCloseCallOfAHoldWhoseUnlockFails }) => {
      expect(theCloseCallOfAHoldWhoseUnlockFails).toHaveBeenCalledExactlyOnceWith(17);
    });
  });

  describe("a generation the lock could not record", () => {
    const generationWriteFailure = new Error("generation failed");
    const it = test
      .extend("theFailureFromAGenerationTheLockCouldNotRecord", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => {
          throw generationWriteFailure;
        });
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        return acquisitionFailure;
      })
      .extend("theUnlockCallForAGenerationTheLockCouldNotRecord", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => {
          throw generationWriteFailure;
        });
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (acquisitionFailure === null) throw new Error("the acquisition did not fail");
        return unlock;
      })
      .extend("theCloseCallForAGenerationTheLockCouldNotRecord", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => undefined);
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => {
          throw generationWriteFailure;
        });
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (acquisitionFailure === null) throw new Error("the acquisition did not fail");
        return close;
      });

    it("hands the generation failure on", ({ theFailureFromAGenerationTheLockCouldNotRecord }) => {
      expect(theFailureFromAGenerationTheLockCouldNotRecord).toBe(generationWriteFailure);
    });

    it("unlocks the descriptor once", ({ theUnlockCallForAGenerationTheLockCouldNotRecord }) => {
      expect(theUnlockCallForAGenerationTheLockCouldNotRecord).toHaveBeenCalledExactlyOnceWith(17);
    });

    it("closes the descriptor once", ({ theCloseCallForAGenerationTheLockCouldNotRecord }) => {
      expect(theCloseCallForAGenerationTheLockCouldNotRecord).toHaveBeenCalledExactlyOnceWith(17);
    });
  });

  describe("a generation failure whose release also fails", () => {
    const generationWriteFailure = new Error("generation failed");
    const releaseFailure = new Error("unlock failed");
    const it = test
      .extend("theGenerationFailureGatheredFirstWhenTheReleaseAlsoFails", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => {
          throw releaseFailure;
        });
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => {
          throw generationWriteFailure;
        });
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (!(acquisitionFailure instanceof AggregateError)) throw new Error("nothing gathered");
        return acquisitionFailure.errors.at(0) === generationWriteFailure;
      })
      .extend("theReleaseFailureGatheredSecondWhenTheGenerationAlsoFails", () => {
        const open = vi.fn<(path: string) => number>(() => 17);
        const tryLock = vi.fn<(descriptor: number) => boolean>(() => true);
        const unlock = vi.fn<(descriptor: number) => void>(() => {
          throw releaseFailure;
        });
        const close = vi.fn<(descriptor: number) => void>(() => undefined);
        const recordGeneration = vi.fn<() => void>(() => {
          throw generationWriteFailure;
        });
        const fileLock = { path: "slot.lock", open, tryLock, unlock, close, recordGeneration };
        const [acquisitionFailure] = attempt(() => tryAcquireFileLock(fileLock));
        if (!(acquisitionFailure instanceof AggregateError)) throw new Error("nothing gathered");
        return acquisitionFailure.errors.at(1) === releaseFailure;
      });

    it("gathers the generation failure first", ({
      theGenerationFailureGatheredFirstWhenTheReleaseAlsoFails,
    }) => {
      expect(theGenerationFailureGatheredFirstWhenTheReleaseAlsoFails).toBe(true);
    });

    it("gathers the release failure second", ({
      theReleaseFailureGatheredSecondWhenTheGenerationAlsoFails,
    }) => {
      expect(theReleaseFailureGatheredSecondWhenTheGenerationAlsoFails).toBe(true);
    });
  });
});
