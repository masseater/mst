import { attempt } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import { closeFileDescriptorAfterFailure, releaseFileLock } from "./release-file-lock.ts";

describe("releaseFileLock", () => {
  describe("the unlock of a release whose operations both succeed", () => {
    const it = test.extend("unlockOfSucceedingRelease", () => {
      const unlock = vi.fn<(descriptor: number) => void>();
      releaseFileLock({
        descriptor: 7,
        unlock,
        close: vi.fn<(descriptor: number) => void>(),
      });
      return unlock;
    });

    it("runs once against the descriptor the release was handed", ({
      unlockOfSucceedingRelease,
    }) => {
      expect(unlockOfSucceedingRelease).toHaveBeenCalledExactlyOnceWith(7);
    });
  });

  describe("the close of a release whose operations both succeed", () => {
    const it = test.extend("closeOfSucceedingRelease", () => {
      const close = vi.fn<(descriptor: number) => void>();
      releaseFileLock({
        descriptor: 7,
        unlock: vi.fn<(descriptor: number) => void>(),
        close,
      });
      return close;
    });

    it("follows the unlock against the same descriptor", ({ closeOfSucceedingRelease }) => {
      expect(closeOfSucceedingRelease).toHaveBeenCalledExactlyOnceWith(7);
    });
  });

  describe("the close of a release whose unlock failed", () => {
    const it = test.extend("closeOfReleaseWithFailingUnlock", () => {
      const close = vi.fn<(descriptor: number) => void>();
      const [releaseFailure] = attempt<true, Error>(() => {
        releaseFileLock({
          descriptor: 8,
          unlock: () => {
            throw new Error("unlock failed");
          },
          close,
        });
        return true;
      });
      if (releaseFailure === null) throw new Error("the release was expected to fail");
      return close;
    });

    it("still runs against the descriptor the release was handed", ({
      closeOfReleaseWithFailingUnlock,
    }) => {
      expect(closeOfReleaseWithFailingUnlock).toHaveBeenCalledExactlyOnceWith(8);
    });
  });

  describe("the failure of a release whose unlock failed", () => {
    const it = test.extend("failureOfReleaseWithFailingUnlock", () => {
      const [releaseFailure] = attempt<true, Error>(() => {
        releaseFileLock({
          descriptor: 8,
          unlock: () => {
            throw new Error("unlock failed");
          },
          close: vi.fn<(descriptor: number) => void>(),
        });
        return true;
      });
      return releaseFailure;
    });

    it("carries the failure the unlock raised", ({ failureOfReleaseWithFailingUnlock }) => {
      expect(failureOfReleaseWithFailingUnlock).toStrictEqual(new Error("unlock failed"));
    });
  });

  describe("the unlock of a release whose close failed", () => {
    const it = test.extend("unlockOfReleaseWithFailingClose", () => {
      const unlock = vi.fn<(descriptor: number) => void>();
      const [releaseFailure] = attempt<true, Error>(() => {
        releaseFileLock({
          descriptor: 9,
          unlock,
          close: () => {
            throw new Error("close failed");
          },
        });
        return true;
      });
      if (releaseFailure === null) throw new Error("the release was expected to fail");
      return unlock;
    });

    it("had already run against the descriptor the release was handed", ({
      unlockOfReleaseWithFailingClose,
    }) => {
      expect(unlockOfReleaseWithFailingClose).toHaveBeenCalledExactlyOnceWith(9);
    });
  });

  describe("the failure of a release whose close failed", () => {
    const it = test.extend("failureOfReleaseWithFailingClose", () => {
      const [releaseFailure] = attempt<true, Error>(() => {
        releaseFileLock({
          descriptor: 9,
          unlock: vi.fn<(descriptor: number) => void>(),
          close: () => {
            throw new Error("close failed");
          },
        });
        return true;
      });
      return releaseFailure;
    });

    it("carries the failure the close raised", ({ failureOfReleaseWithFailingClose }) => {
      expect(failureOfReleaseWithFailingClose).toStrictEqual(new Error("close failed"));
    });
  });

  describe("the failure of a release whose unlock and close both failed", () => {
    const it = test.extend("failureOfReleaseWithBothOperationsFailing", () => {
      const [releaseFailure] = attempt<true, Error>(() => {
        releaseFileLock({
          descriptor: 10,
          unlock: () => {
            throw new Error("unlock failed");
          },
          close: () => {
            throw new Error("close failed");
          },
        });
        return true;
      });
      return releaseFailure;
    });

    it("gathers both failures in the order the operations ran", ({
      failureOfReleaseWithBothOperationsFailing,
    }) => {
      expect(failureOfReleaseWithBothOperationsFailing).toStrictEqual(
        new AggregateError(
          [new Error("unlock failed"), new Error("close failed")],
          "Could not unlock and close file descriptor 10",
        ),
      );
    });
  });
});

describe("closeFileDescriptorAfterFailure", () => {
  describe("the close that follows a failed operation", () => {
    const it = test.extend("closeFollowingAFailedOperation", () => {
      const close = vi.fn<(descriptor: number) => void>();
      const [surfacedFailure] = attempt<never, Error>(() =>
        closeFileDescriptorAfterFailure({
          descriptor: 11,
          precedingFailure: new Error("operation failed"),
          close,
        }),
      );
      if (surfacedFailure === null) throw new Error("the close was expected to surface a failure");
      return close;
    });

    it("runs once against the descriptor it was handed", ({ closeFollowingAFailedOperation }) => {
      expect(closeFollowingAFailedOperation).toHaveBeenCalledExactlyOnceWith(11);
    });
  });

  describe("the failure surfaced when only the preceding operation failed", () => {
    const it = test.extend("failureSurfacedByASucceedingClose", () => {
      const [surfacedFailure] = attempt<never, Error>(() =>
        closeFileDescriptorAfterFailure({
          descriptor: 11,
          precedingFailure: new Error("operation failed"),
          close: vi.fn<(descriptor: number) => void>(),
        }),
      );
      return surfacedFailure;
    });

    it("carries the failure that preceded the close", ({ failureSurfacedByASucceedingClose }) => {
      expect(failureSurfacedByASucceedingClose).toStrictEqual(new Error("operation failed"));
    });
  });

  describe("the failure surfaced when the close failed as well", () => {
    const it = test.extend("failureSurfacedByAFailingClose", () => {
      const [surfacedFailure] = attempt<never, Error>(() =>
        closeFileDescriptorAfterFailure({
          descriptor: 12,
          precedingFailure: new Error("operation failed"),
          close: () => {
            throw new Error("close failed");
          },
        }),
      );
      return surfacedFailure;
    });

    it("gathers the preceding failure ahead of the close failure", ({
      failureSurfacedByAFailingClose,
    }) => {
      expect(failureSurfacedByAFailingClose).toStrictEqual(
        new AggregateError(
          [new Error("operation failed"), new Error("close failed")],
          "Operation and close both failed for file descriptor 12",
        ),
      );
    });
  });
});
