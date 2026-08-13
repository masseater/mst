import { spawn } from "node:child_process";
import { once } from "node:events";

import { describe, expect, test, vi } from "vite-plus/test";

import {
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterrupt,
  makeRunningInterruptHandler,
  makeWaitingInterruptHandler,
  raiseSignal,
  safeKill,
} from "./signals.ts";

const LINGERING_COMMAND = ["-e", "setInterval(() => {}, 1000);"];

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
    const it = test.extend("theKillCallOfARunningInterrupt", () => {
      const kill = vi.fn<(pid: number, signal: NodeJS.Signals) => boolean>(() => true);
      makeRunningInterruptHandler({ childPid: 4321, kill })("SIGINT");
      return kill;
    });

    it("forwards the signal to the child's process group", ({ theKillCallOfARunningInterrupt }) => {
      expect(theKillCallOfARunningInterrupt).toHaveBeenCalledWith(-4321, "SIGINT");
    });
  });
});

describe("safeKill", () => {
  describe("a termination signal sent to a live process", () => {
    const it = test
      .extend("theAnswerOfKillingALiveProcess", () => {
        const child = spawn(process.execPath, LINGERING_COMMAND);
        const delivered = safeKill(child.pid ?? 0, "SIGTERM");
        child.kill("SIGKILL");
        return delivered;
      })
      .extend("theExitOfALiveProcessThatWasSignalled", async () => {
        const child = spawn(process.execPath, LINGERING_COMMAND);
        const childDeath = once(child, "exit");
        safeKill(child.pid ?? 0, "SIGTERM");
        return childDeath;
      });

    it("reports the signal as delivered", ({ theAnswerOfKillingALiveProcess }) => {
      expect(theAnswerOfKillingALiveProcess).toBe(true);
    });

    it("is the signal the process dies of", ({ theExitOfALiveProcessThatWasSignalled }) => {
      expect(theExitOfALiveProcessThatWasSignalled).toStrictEqual([null, "SIGTERM"]);
    });
  });

  describe("a termination signal sent to a process that is already gone", () => {
    const it = test.extend("theAnswerOfKillingADeadProcess", async () => {
      const child = spawn(process.execPath, LINGERING_COMMAND);
      const childDeath = once(child, "exit");
      safeKill(child.pid ?? 0, "SIGTERM");
      await childDeath;
      return safeKill(child.pid ?? 0, "SIGTERM");
    });

    it("swallows the miss", ({ theAnswerOfKillingADeadProcess }) => {
      expect(theAnswerOfKillingADeadProcess).toBe(false);
    });
  });

  describe("a signal this platform has no name for", () => {
    const it = test.extend("theRefusalOfAnUnknownSignal", () => {
      try {
        return safeKill(process.pid, "SIGNOTREAL" as NodeJS.Signals);
      } catch (refused) {
        return refused instanceof Error ? refused.message : String(refused);
      }
    });

    it("hands the refusal on rather than reading it as a missing process", ({
      theRefusalOfAnUnknownSignal,
    }) => {
      expect(theRefusalOfAnUnknownSignal).toBe("Unknown signal: SIGNOTREAL");
    });
  });
});

describe("raiseSignal", () => {
  describe("a window change raised on this process", () => {
    const it = test.extend("theSignalNamedByTheWindowChangeThisProcessReceived", async () => {
      const received = once(process, "SIGWINCH");
      raiseSignal("SIGWINCH");
      const delivered: unknown[] = await received;
      return delivered.slice(0, 1);
    });

    it("sends the signal to the wrapper's own process", ({
      theSignalNamedByTheWindowChangeThisProcessReceived,
    }) => {
      expect(theSignalNamedByTheWindowChangeThisProcessReceived).toStrictEqual(["SIGWINCH"]);
    });
  });
});
