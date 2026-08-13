import { attempt } from "es-toolkit";
import { describe, expect, test, vi } from "vite-plus/test";

import {
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterrupt,
  makeRunningInterruptHandler,
  makeWaitingInterruptHandler,
  raiseSignal,
} from "./signals.ts";

describe("installInterruptHandler", () => {
  describe("a handler installed on this process", () => {
    const it = test
      .extend("theInterruptHandlerIsRegisteredForInterrupt", ({}, { onCleanup }) => {
        const interruptHandler = vi.fn<(signal: NodeJS.Signals) => void>();
        onCleanup(() => {
          dropInterruptHandler(interruptHandler);
        });
        installInterruptHandler(interruptHandler);
        return process.listeners("SIGINT").includes(interruptHandler);
      })
      .extend("theInterruptHandlerIsRegisteredForTermination", ({}, { onCleanup }) => {
        const interruptHandler = vi.fn<(signal: NodeJS.Signals) => void>();
        onCleanup(() => {
          dropInterruptHandler(interruptHandler);
        });
        installInterruptHandler(interruptHandler);
        return process.listeners("SIGTERM").includes(interruptHandler);
      });

    it("registers the handler for the interrupt signal", ({
      theInterruptHandlerIsRegisteredForInterrupt,
    }) => {
      expect(theInterruptHandlerIsRegisteredForInterrupt).toBe(true);
    });

    it("registers the handler for the termination signal", ({
      theInterruptHandlerIsRegisteredForTermination,
    }) => {
      expect(theInterruptHandlerIsRegisteredForTermination).toBe(true);
    });
  });
});

describe("dropInterruptHandler", () => {
  describe("a handler dropped after it was installed", () => {
    const it = test
      .extend("theInterruptHandlerIsGoneFromInterruptAfterDropping", () => {
        const interruptHandler = vi.fn<(signal: NodeJS.Signals) => void>();
        installInterruptHandler(interruptHandler);
        dropInterruptHandler(interruptHandler);
        return process.listeners("SIGINT").includes(interruptHandler);
      })
      .extend("theInterruptHandlerIsGoneFromTerminationAfterDropping", () => {
        const interruptHandler = vi.fn<(signal: NodeJS.Signals) => void>();
        installInterruptHandler(interruptHandler);
        dropInterruptHandler(interruptHandler);
        return process.listeners("SIGTERM").includes(interruptHandler);
      });

    it("takes the handler off the interrupt signal", ({
      theInterruptHandlerIsGoneFromInterruptAfterDropping,
    }) => {
      expect(theInterruptHandlerIsGoneFromInterruptAfterDropping).toBe(false);
    });

    it("takes the handler off the termination signal", ({
      theInterruptHandlerIsGoneFromTerminationAfterDropping,
    }) => {
      expect(theInterruptHandlerIsGoneFromTerminationAfterDropping).toBe(false);
    });
  });
});

describe("makeWaitingInterruptHandler", () => {
  describe("a termination signal handed to a waiting handler", () => {
    const it = test
      .extend("theRemoveEntryCallOfAWaitingInterrupt", () => {
        const removeEntry = vi.fn<(entryPath: string) => void>();
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        makeWaitingInterruptHandler({ entryPath: "/queue/entry", removeEntry, raise })("SIGTERM");
        return removeEntry;
      })
      .extend("theRaiseCallOfAWaitingInterrupt", () => {
        const removeEntry = vi.fn<(entryPath: string) => void>();
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        makeWaitingInterruptHandler({ entryPath: "/queue/entry", removeEntry, raise })("SIGTERM");
        return raise;
      })
      .extend("theQueueEntryIsRemovedBeforeTheSignalIsRaised", () => {
        const removeEntry = vi.fn<(entryPath: string) => void>();
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        makeWaitingInterruptHandler({ entryPath: "/queue/entry", removeEntry, raise })("SIGTERM");
        return (
          (removeEntry.mock.invocationCallOrder[0] ?? 0) < (raise.mock.invocationCallOrder[0] ?? 0)
        );
      });

    it("removes its own queue entry", ({ theRemoveEntryCallOfAWaitingInterrupt }) => {
      expect(theRemoveEntryCallOfAWaitingInterrupt).toHaveBeenCalledWith("/queue/entry");
    });

    it("re-raises the signal it was handed", ({ theRaiseCallOfAWaitingInterrupt }) => {
      expect(theRaiseCallOfAWaitingInterrupt).toHaveBeenCalledWith("SIGTERM");
    });

    it("removes its entry before re-raising", ({
      theQueueEntryIsRemovedBeforeTheSignalIsRaised,
    }) => {
      expect(theQueueEntryIsRemovedBeforeTheSignalIsRaised).toBe(true);
    });
  });
});

describe("makeHeldInterrupt", () => {
  describe("an interrupt handed to a hold on a slot", () => {
    const it = test
      .extend("theReleaseCallOfAHeldInterrupt", async () => {
        const release = vi.fn<() => Promise<void>>(async () => undefined);
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        const onUnreleased = vi.fn<(failure: Error) => void>();
        const held = makeHeldInterrupt({ release, raise, onUnreleased });
        held.handler("SIGINT");
        await held.settled;
        return release;
      })
      .extend("theRaiseCallOfAHeldInterrupt", async () => {
        const release = vi.fn<() => Promise<void>>(async () => undefined);
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        const onUnreleased = vi.fn<(failure: Error) => void>();
        const held = makeHeldInterrupt({ release, raise, onUnreleased });
        held.handler("SIGINT");
        await held.settled;
        return raise;
      });

    it("releases the slot once", ({ theReleaseCallOfAHeldInterrupt }) => {
      expect(theReleaseCallOfAHeldInterrupt).toHaveBeenCalledTimes(1);
    });

    it("re-raises the signal it was handed", ({ theRaiseCallOfAHeldInterrupt }) => {
      expect(theRaiseCallOfAHeldInterrupt).toHaveBeenCalledWith("SIGINT");
    });
  });

  describe("a termination signal whose release fails", () => {
    const it = test
      .extend("theRaiseCallAfterAFailedRelease", async () => {
        const release = vi.fn<() => Promise<void>>(async () => {
          throw new Error("lease already reclaimed");
        });
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        const onUnreleased = vi.fn<(failure: Error) => void>();
        const held = makeHeldInterrupt({ release, raise, onUnreleased });
        held.handler("SIGTERM");
        await held.settled;
        return raise;
      })
      .extend("theUnreleasedReportAfterAFailedRelease", async () => {
        const release = vi.fn<() => Promise<void>>(async () => {
          throw new Error("lease already reclaimed");
        });
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        const onUnreleased = vi.fn<(failure: Error) => void>();
        const held = makeHeldInterrupt({ release, raise, onUnreleased });
        held.handler("SIGTERM");
        await held.settled;
        return onUnreleased;
      });

    it("still re-raises the signal it was handed", ({ theRaiseCallAfterAFailedRelease }) => {
      expect(theRaiseCallAfterAFailedRelease).toHaveBeenCalledWith("SIGTERM");
    });

    it("hands the failed release on once", ({ theUnreleasedReportAfterAFailedRelease }) => {
      expect(theUnreleasedReportAfterAFailedRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe("a hold that stood down without an interrupt", () => {
    const it = test
      .extend("theReleaseCallOfAHoldThatStoodDown", async () => {
        const release = vi.fn<() => Promise<void>>(async () => undefined);
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        const onUnreleased = vi.fn<(failure: Error) => void>();
        const held = makeHeldInterrupt({ release, raise, onUnreleased });
        held.standDown();
        await held.settled;
        return release;
      })
      .extend("theRaiseCallOfAHoldThatStoodDown", async () => {
        const release = vi.fn<() => Promise<void>>(async () => undefined);
        const raise = vi.fn<(signal: NodeJS.Signals) => void>();
        const onUnreleased = vi.fn<(failure: Error) => void>();
        const held = makeHeldInterrupt({ release, raise, onUnreleased });
        held.standDown();
        await held.settled;
        return raise;
      });

    it("leaves the slot to its owner", ({ theReleaseCallOfAHoldThatStoodDown }) => {
      expect(theReleaseCallOfAHoldThatStoodDown).toHaveBeenCalledTimes(0);
    });

    it("raises nothing", ({ theRaiseCallOfAHoldThatStoodDown }) => {
      expect(theRaiseCallOfAHoldThatStoodDown).toHaveBeenCalledTimes(0);
    });
  });
});

describe("makeRunningInterruptHandler", () => {
  describe("an interrupt handed to a handler watching a child", () => {
    const it = test
      .extend("theSignalTreeCallOfARunningInterrupt", () => {
        const signalTree = vi.fn<(input: { pid: number; signal: NodeJS.Signals }) => Error | null>(
          () => null,
        );
        const reportFailure = vi.fn<(failure: Error) => void>();
        makeRunningInterruptHandler({ childPid: 4321, signalTree, reportFailure })("SIGINT");
        return signalTree;
      })
      .extend("theFailureReportOfASignalledProcessTree", () => {
        const signalTree = vi.fn<(input: { pid: number; signal: NodeJS.Signals }) => Error | null>(
          () => null,
        );
        const reportFailure = vi.fn<(failure: Error) => void>();
        makeRunningInterruptHandler({ childPid: 4321, signalTree, reportFailure })("SIGINT");
        return reportFailure;
      });

    it("forwards the signal to the child's process tree", ({
      theSignalTreeCallOfARunningInterrupt,
    }) => {
      expect(theSignalTreeCallOfARunningInterrupt).toHaveBeenCalledWith({
        pid: 4321,
        signal: "SIGINT",
      });
    });

    it("reports nothing when the tree took the signal", ({
      theFailureReportOfASignalledProcessTree,
    }) => {
      expect(theFailureReportOfASignalledProcessTree).toHaveBeenCalledTimes(0);
    });
  });

  describe("a termination signal the child's process tree refuses", () => {
    const it = test.extend("theRefusalOfTheProcessTreeIsHandedOn", () => {
      const refusal = new Error("signalling the process tree failed");
      const reportFailure = vi.fn<(reported: Error) => void>();
      makeRunningInterruptHandler({
        childPid: 4321,
        signalTree: () => refusal,
        reportFailure,
      })("SIGTERM");
      return reportFailure.mock.calls[0]?.[0] === refusal;
    });

    it("hands the refusal on", ({ theRefusalOfTheProcessTreeIsHandedOn }) => {
      expect(theRefusalOfTheProcessTreeIsHandedOn).toBe(true);
    });
  });
});

describe("raiseSignal", () => {
  describe("a window change raised on this process", () => {
    const it = test.extend("theRefusalOfRaisingAWindowChange", () => {
      const [refusal] = attempt<true, Error>(() => {
        raiseSignal("SIGWINCH");
        return true;
      });
      return refusal;
    });

    it("sends the signal to the wrapper's own process", ({ theRefusalOfRaisingAWindowChange }) => {
      expect(theRefusalOfRaisingAWindowChange).toBe(null);
    });
  });
});
