import { describe, expect, test, vi } from "vite-plus/test";

import { signalProcessTree } from "./process-tree.ts";

type SignalTreeInput = Parameters<typeof signalProcessTree>[0];
type TaskkillExecutor = NonNullable<
  NonNullable<SignalTreeInput["dependencies"]>["executeTaskkill"]
>;

describe("signalProcessTree", () => {
  describe("a Windows tree that taskkill accepted", () => {
    const it = test
      .extend("theOutcomeOfATaskkillThatAccepted", () => {
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        return signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "win32", executeTaskkill },
        });
      })
      .extend("theTaskkillInvocationOfAnAcceptedTree", () => {
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "win32", executeTaskkill },
        });
        return executeTaskkill;
      });

    it("reports no failure", ({ theOutcomeOfATaskkillThatAccepted }) => {
      expect(theOutcomeOfATaskkillThatAccepted).toBe(null);
    });

    it("hands taskkill one literal pid and the forceful tree flags", ({
      theTaskkillInvocationOfAnAcceptedTree,
    }) => {
      expect(theTaskkillInvocationOfAnAcceptedTree).toHaveBeenCalledWith({
        executable: "taskkill",
        handedArguments: ["/PID", "4321", "/T", "/F"],
        spawnConfiguration: { stdio: "ignore", windowsHide: true },
      });
    });
  });

  describe("a taskkill that never started", () => {
    const it = test.extend("theOutcomeOfATaskkillThatNeverStartedIsTheStartFailure", () => {
      const startFailure = new Error("taskkill missing");
      return (
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: {
            platform: "win32",
            executeTaskkill: () => ({ error: startFailure, status: null }),
            signalProcess: () => null,
          },
        }) === startFailure
      );
    });

    it("hands back the failure that kept taskkill from starting", ({
      theOutcomeOfATaskkillThatNeverStartedIsTheStartFailure,
    }) => {
      expect(theOutcomeOfATaskkillThatNeverStartedIsTheStartFailure).toBe(true);
    });
  });

  describe("a taskkill that exited with a code", () => {
    const it = test.extend("theOutcomeOfATaskkillThatExitedWithACode", () =>
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: {
          platform: "win32",
          executeTaskkill: () => ({ status: 5 }),
          signalProcess: () => null,
        },
      }));

    it("names the exit code in the failure", ({ theOutcomeOfATaskkillThatExitedWithACode }) => {
      expect(theOutcomeOfATaskkillThatExitedWithACode).toStrictEqual(
        new Error("taskkill exited with code 5"),
      );
    });
  });

  describe("a taskkill that exited without a code", () => {
    const it = test.extend("theOutcomeOfATaskkillThatExitedWithoutACode", () =>
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: {
          platform: "win32",
          executeTaskkill: () => ({ status: null }),
          signalProcess: () => null,
        },
      }));

    it("calls the missing exit code unknown", ({ theOutcomeOfATaskkillThatExitedWithoutACode }) => {
      expect(theOutcomeOfATaskkillThatExitedWithoutACode).toStrictEqual(
        new Error("taskkill exited with code unknown"),
      );
    });
  });

  describe("the native taskkill invocation aimed at a nonexistent process", () => {
    const it = test.extend("theNativeTaskkillOutcomeForANonexistentProcessIsAFailure", () => {
      const nativeTaskkillFailure = signalProcessTree({
        pid: 999_999_999,
        signal: "SIGTERM",
        dependencies: { platform: "win32" },
      });
      return nativeTaskkillFailure instanceof Error;
    });

    it("reports the nonexistent process as a failure", ({
      theNativeTaskkillOutcomeForANonexistentProcessIsAFailure,
    }) => {
      expect(theNativeTaskkillOutcomeForANonexistentProcessIsAFailure).toBe(true);
    });
  });

  describe("a POSIX process group that took the signal", () => {
    const it = test
      .extend("theOutcomeOfASignalledPosixProcessGroup", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        return signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "linux", signalProcess, executeTaskkill },
        });
      })
      .extend("theProcessSignalsOfASignalledPosixProcessGroup", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "linux", signalProcess, executeTaskkill },
        });
        return signalProcess;
      })
      .extend("theTaskkillInvocationsOfASignalledPosixProcessGroup", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "linux", signalProcess, executeTaskkill },
        });
        return executeTaskkill;
      });

    it("reports no failure", ({ theOutcomeOfASignalledPosixProcessGroup }) => {
      expect(theOutcomeOfASignalledPosixProcessGroup).toBe(null);
    });

    it("signals the group behind the negated pid", ({
      theProcessSignalsOfASignalledPosixProcessGroup,
    }) => {
      expect(theProcessSignalsOfASignalledPosixProcessGroup).toHaveBeenCalledWith(-4321, "SIGTERM");
    });

    it("never signals the root on its own", ({
      theProcessSignalsOfASignalledPosixProcessGroup,
    }) => {
      expect(theProcessSignalsOfASignalledPosixProcessGroup).toHaveBeenCalledTimes(1);
    });

    it("leaves taskkill untouched", ({ theTaskkillInvocationsOfASignalledPosixProcessGroup }) => {
      expect(theTaskkillInvocationsOfASignalledPosixProcessGroup).toHaveBeenCalledTimes(0);
    });
  });

  describe("a Windows tree handed over as a whole", () => {
    const it = test
      .extend("theOutcomeOfAWindowsTreeHandedOverAsAWhole", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        return signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "win32", signalProcess, executeTaskkill },
        });
      })
      .extend("theTaskkillInvocationsOfAWindowsTreeHandedOverAsAWhole", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "win32", signalProcess, executeTaskkill },
        });
        return executeTaskkill;
      })
      .extend("theProcessSignalsOfAWindowsTreeHandedOverAsAWhole", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: { platform: "win32", signalProcess, executeTaskkill },
        });
        return signalProcess;
      });

    it("reports no failure", ({ theOutcomeOfAWindowsTreeHandedOverAsAWhole }) => {
      expect(theOutcomeOfAWindowsTreeHandedOverAsAWhole).toBe(null);
    });

    it("delegates the whole tree to taskkill once", ({
      theTaskkillInvocationsOfAWindowsTreeHandedOverAsAWhole,
    }) => {
      expect(theTaskkillInvocationsOfAWindowsTreeHandedOverAsAWhole).toHaveBeenCalledTimes(1);
    });

    it("signals no process itself", ({ theProcessSignalsOfAWindowsTreeHandedOverAsAWhole }) => {
      expect(theProcessSignalsOfAWindowsTreeHandedOverAsAWhole).toHaveBeenCalledTimes(0);
    });
  });

  describe("a POSIX group that refused the signal while its root took it", () => {
    const it = test
      .extend("theOutcomeOfAPosixGroupThatRefusedIsTheGroupFailure", () => {
        const groupFailure = new Error("group missing");
        const signalProcess = vi
          .fn<(pid: number, signal: NodeJS.Signals) => Error | null>()
          .mockReturnValueOnce(groupFailure)
          .mockReturnValueOnce(null);
        return (
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: {
              platform: "darwin",
              signalProcess,
              executeTaskkill: () => ({ status: 0 }),
            },
          }) === groupFailure
        );
      })
      .extend("theProcessSignalsOfAPosixGroupThatRefused", () => {
        const signalProcess = vi
          .fn<(pid: number, signal: NodeJS.Signals) => Error | null>()
          .mockReturnValueOnce(new Error("group missing"))
          .mockReturnValueOnce(null);
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: {
            platform: "darwin",
            signalProcess,
            executeTaskkill: () => ({ status: 0 }),
          },
        });
        return signalProcess;
      });

    it("keeps the group failure observable", ({
      theOutcomeOfAPosixGroupThatRefusedIsTheGroupFailure,
    }) => {
      expect(theOutcomeOfAPosixGroupThatRefusedIsTheGroupFailure).toBe(true);
    });

    it("aims the first signal at the group", ({ theProcessSignalsOfAPosixGroupThatRefused }) => {
      expect(theProcessSignalsOfAPosixGroupThatRefused).toHaveBeenNthCalledWith(
        1,
        -4321,
        "SIGTERM",
      );
    });

    it("falls back to the root with the same signal", ({
      theProcessSignalsOfAPosixGroupThatRefused,
    }) => {
      expect(theProcessSignalsOfAPosixGroupThatRefused).toHaveBeenNthCalledWith(2, 4321, "SIGTERM");
    });
  });

  describe("a POSIX group and root that are both gone", () => {
    const it = test.extend("theOutcomeOfAPosixGroupAndRootThatAreBothGone", () => {
      class MissingProcessError extends Error {
        readonly code = "ESRCH";
      }
      const missingProcess = new MissingProcessError("missing");
      return signalProcessTree({
        pid: 4321,
        signal: "SIGKILL",
        dependencies: {
          platform: "darwin",
          signalProcess: () => missingProcess,
          executeTaskkill: () => ({ status: 0 }),
        },
      });
    });

    it("treats the shutdown as already completed", ({
      theOutcomeOfAPosixGroupAndRootThatAreBothGone,
    }) => {
      expect(theOutcomeOfAPosixGroupAndRootThatAreBothGone).toBe(null);
    });
  });

  describe("a Windows taskkill that was denied while the root took the signal", () => {
    const it = test
      .extend("theOutcomeOfADeniedTaskkillIsTheTaskkillFailure", () => {
        const taskkillFailure = new Error("taskkill denied");
        return (
          signalProcessTree({
            pid: 4321,
            signal: "SIGTERM",
            dependencies: {
              platform: "win32",
              signalProcess: () => null,
              executeTaskkill: () => ({ error: taskkillFailure, status: null }),
            },
          }) === taskkillFailure
        );
      })
      .extend("theProcessSignalsOfADeniedTaskkill", () => {
        const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(
          () => null,
        );
        signalProcessTree({
          pid: 4321,
          signal: "SIGTERM",
          dependencies: {
            platform: "win32",
            signalProcess,
            executeTaskkill: () => ({ error: new Error("taskkill denied"), status: null }),
          },
        });
        return signalProcess;
      });

    it("keeps the taskkill failure observable", ({
      theOutcomeOfADeniedTaskkillIsTheTaskkillFailure,
    }) => {
      expect(theOutcomeOfADeniedTaskkillIsTheTaskkillFailure).toBe(true);
    });

    it("force-kills the root on its own", ({ theProcessSignalsOfADeniedTaskkill }) => {
      expect(theProcessSignalsOfADeniedTaskkill).toHaveBeenCalledWith(4321, "SIGKILL");
    });
  });

  describe("a tree and a root that both refused termination", () => {
    const it = test
      .extend("theOutcomeOfATreeAndRootThatBothRefusedIsAnAggregate", () => {
        const bothRefused = signalProcessTree({
          pid: 4321,
          signal: "SIGKILL",
          dependencies: {
            platform: "win32",
            signalProcess: () => new Error("root denied"),
            executeTaskkill: () => ({ error: new Error("tree denied"), status: null }),
          },
        });
        return bothRefused instanceof AggregateError;
      })
      .extend("theRefusalsGatheredFromATreeAndItsRoot", () => {
        const bothRefused = signalProcessTree({
          pid: 4321,
          signal: "SIGKILL",
          dependencies: {
            platform: "win32",
            signalProcess: () => new Error("root denied"),
            executeTaskkill: () => ({ error: new Error("tree denied"), status: null }),
          },
        });
        return bothRefused instanceof AggregateError ? bothRefused.errors : null;
      });

    it("gathers both refusals into one failure", ({
      theOutcomeOfATreeAndRootThatBothRefusedIsAnAggregate,
    }) => {
      expect(theOutcomeOfATreeAndRootThatBothRefusedIsAnAggregate).toBe(true);
    });

    it("preserves the tree refusal ahead of the root refusal", ({
      theRefusalsGatheredFromATreeAndItsRoot,
    }) => {
      expect(theRefusalsGatheredFromATreeAndItsRoot).toStrictEqual([
        new Error("tree denied"),
        new Error("root denied"),
      ]);
    });
  });
});
