import { describe, expect, test, vi } from "vite-plus/test";

import { closeFileDescriptorAfterFailure, releaseFileLock } from "./release-file-lock.ts";

const operations = (failures: { unlock?: Error; close?: Error } = {}) => ({
  unlock: vi.fn<(descriptor: number) => void>(() => {
    if (failures.unlock !== undefined) throw failures.unlock;
  }),
  close: vi.fn<(descriptor: number) => void>(() => {
    if (failures.close !== undefined) throw failures.close;
  }),
});

describe("releaseFileLock", () => {
  test("unlocks and closes the descriptor", () => {
    const fileOperations = operations();

    releaseFileLock({ descriptor: 7, ...fileOperations });

    expect(fileOperations.unlock).toHaveBeenCalledExactlyOnceWith(7);
    expect(fileOperations.close).toHaveBeenCalledExactlyOnceWith(7);
  });

  test("closes the descriptor after an unlock failure and preserves that failure", () => {
    const unlockFailure = new Error("unlock failed");
    const fileOperations = operations({ unlock: unlockFailure });

    expect(() => {
      releaseFileLock({ descriptor: 8, ...fileOperations });
    }).toThrow(unlockFailure);
    expect(fileOperations.close).toHaveBeenCalledExactlyOnceWith(8);
  });

  test("preserves a close failure", () => {
    const closeFailure = new Error("close failed");
    const fileOperations = operations({ close: closeFailure });

    expect(() => {
      releaseFileLock({ descriptor: 9, ...fileOperations });
    }).toThrow(closeFailure);
    expect(fileOperations.unlock).toHaveBeenCalledExactlyOnceWith(9);
  });

  test("preserves both failures when unlock and close fail", () => {
    const unlockFailure = new Error("unlock failed");
    const closeFailure = new Error("close failed");
    const fileOperations = operations({ unlock: unlockFailure, close: closeFailure });

    const releaseFailure = (() => {
      try {
        releaseFileLock({ descriptor: 10, ...fileOperations });
        return null;
      } catch (failure) {
        return failure;
      }
    })();

    expect(releaseFailure).toBeInstanceOf(AggregateError);
    expect((releaseFailure as AggregateError).errors).toStrictEqual([unlockFailure, closeFailure]);
  });
});

describe("closeFileDescriptorAfterFailure", () => {
  test("closes the descriptor and preserves the preceding failure", () => {
    const precedingFailure = new Error("operation failed");
    const close = vi.fn<(descriptor: number) => void>();

    expect(() =>
      closeFileDescriptorAfterFailure({ descriptor: 11, precedingFailure, close }),
    ).toThrow(precedingFailure);
    expect(close).toHaveBeenCalledExactlyOnceWith(11);
  });

  test("preserves both the preceding and close failures", () => {
    const precedingFailure = new Error("operation failed");
    const closeFailure = new Error("close failed");

    const combinedFailure = (() => {
      try {
        closeFileDescriptorAfterFailure({
          descriptor: 12,
          precedingFailure,
          close: () => {
            throw closeFailure;
          },
        });
      } catch (failure) {
        return failure;
      }
    })();

    expect(combinedFailure).toBeInstanceOf(AggregateError);
    expect((combinedFailure as AggregateError).errors).toStrictEqual([
      precedingFailure,
      closeFailure,
    ]);
  });
});
