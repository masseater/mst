import { describe, expect, test, vi } from "vite-plus/test";

import { tryAcquireFileLock } from "./acquire-file-lock.ts";

const lockRequest = (
  overrides: {
    tryLock?: (descriptor: number) => boolean;
    unlock?: (descriptor: number) => void;
    close?: (descriptor: number) => void;
    recordGeneration?: () => void;
  } = {},
) => ({
  path: "slot.lock",
  open: vi.fn<(path: string) => number>(() => 17),
  tryLock: vi.fn<(descriptor: number) => boolean>(overrides.tryLock ?? (() => true)),
  unlock: vi.fn<(descriptor: number) => void>(overrides.unlock ?? (() => undefined)),
  close: vi.fn<(descriptor: number) => void>(overrides.close ?? (() => undefined)),
  recordGeneration: vi.fn<() => void>(overrides.recordGeneration ?? (() => undefined)),
});

describe("tryAcquireFileLock", () => {
  test("closes a contended descriptor and returns no hold", () => {
    const fileLock = lockRequest({ tryLock: () => false });

    expect(tryAcquireFileLock(fileLock)).toBeNull();
    expect(fileLock.close).toHaveBeenCalledExactlyOnceWith(17);
    expect(fileLock.recordGeneration).not.toHaveBeenCalled();
  });

  test("closes a contended descriptor exactly once when close fails", () => {
    const closeFailure = new Error("close failed");
    const fileLock = lockRequest({
      tryLock: () => false,
      close: () => {
        throw closeFailure;
      },
    });

    expect(() => tryAcquireFileLock(fileLock)).toThrow(closeFailure);
    expect(fileLock.close).toHaveBeenCalledExactlyOnceWith(17);
    expect(fileLock.recordGeneration).not.toHaveBeenCalled();
  });

  test("closes after a lock failure and preserves that failure", () => {
    const lockFailure = new Error("lock failed");
    const fileLock = lockRequest({
      tryLock: () => {
        throw lockFailure;
      },
    });

    expect(() => tryAcquireFileLock(fileLock)).toThrow(lockFailure);
    expect(fileLock.close).toHaveBeenCalledExactlyOnceWith(17);
  });

  test("preserves lock and close failures together", () => {
    const lockFailure = new Error("lock failed");
    const closeFailure = new Error("close failed");
    const fileLock = lockRequest({
      tryLock: () => {
        throw lockFailure;
      },
      close: () => {
        throw closeFailure;
      },
    });

    const acquisitionFailure = (() => {
      try {
        tryAcquireFileLock(fileLock);
      } catch (failure) {
        return failure;
      }
    })();

    expect(acquisitionFailure).toBeInstanceOf(AggregateError);
    expect((acquisitionFailure as AggregateError).errors).toStrictEqual([
      lockFailure,
      closeFailure,
    ]);
  });

  test("records the generation and shares one successful release", async () => {
    const fileLock = lockRequest();
    const hold = tryAcquireFileLock(fileLock);
    expect(hold).not.toBeNull();

    const firstRelease = hold?.release();
    const secondRelease = hold?.release();

    expect(secondRelease).toBe(firstRelease);
    await Promise.all([firstRelease, secondRelease]);
    expect(fileLock.recordGeneration).toHaveBeenCalledOnce();
    expect(fileLock.unlock).toHaveBeenCalledExactlyOnceWith(17);
    expect(fileLock.close).toHaveBeenCalledExactlyOnceWith(17);
  });

  test("shares one failed release", async () => {
    const releaseFailure = new Error("unlock failed");
    const fileLock = lockRequest({
      unlock: () => {
        throw releaseFailure;
      },
    });
    const hold = tryAcquireFileLock(fileLock);

    const firstRelease = hold?.release();
    const secondRelease = hold?.release();

    expect(secondRelease).toBe(firstRelease);
    await expect(firstRelease).rejects.toBe(releaseFailure);
    await expect(secondRelease).rejects.toBe(releaseFailure);
    expect(fileLock.unlock).toHaveBeenCalledExactlyOnceWith(17);
    expect(fileLock.close).toHaveBeenCalledExactlyOnceWith(17);
  });

  test("releases after a generation failure and preserves that failure", () => {
    const generationWriteFailure = new Error("generation failed");
    const fileLock = lockRequest({
      recordGeneration: () => {
        throw generationWriteFailure;
      },
    });

    expect(() => tryAcquireFileLock(fileLock)).toThrow(generationWriteFailure);
    expect(fileLock.unlock).toHaveBeenCalledExactlyOnceWith(17);
    expect(fileLock.close).toHaveBeenCalledExactlyOnceWith(17);
  });

  test("preserves generation and release failures together", () => {
    const generationWriteFailure = new Error("generation failed");
    const releaseFailure = new Error("unlock failed");
    const fileLock = lockRequest({
      recordGeneration: () => {
        throw generationWriteFailure;
      },
      unlock: () => {
        throw releaseFailure;
      },
    });

    const acquisitionFailure = (() => {
      try {
        tryAcquireFileLock(fileLock);
      } catch (failure) {
        return failure;
      }
    })();

    expect(acquisitionFailure).toBeInstanceOf(AggregateError);
    expect((acquisitionFailure as AggregateError).errors).toStrictEqual([
      generationWriteFailure,
      releaseFailure,
    ]);
  });
});
