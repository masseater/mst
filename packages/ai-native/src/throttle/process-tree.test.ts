import { describe, expect, test, vi } from "vite-plus/test";

import { signalProcessTree } from "./process-tree.ts";

type SignalTreeInput = Parameters<typeof signalProcessTree>[0];
type TaskkillExecutor = NonNullable<
  NonNullable<SignalTreeInput["dependencies"]>["executeTaskkill"]
>;

describe("process-tree", () => {
  test("taskkill receives one literal pid and the forceful tree flags", () => {
    const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));

    expect(
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: { platform: "win32", executeTaskkill },
      }),
    ).toBeNull();
    expect(executeTaskkill).toHaveBeenCalledWith({
      executable: "taskkill",
      handedArguments: ["/PID", "4321", "/T", "/F"],
      spawnConfiguration: { stdio: "ignore", windowsHide: true },
    });
  });

  test("taskkill exposes both start failures and non-zero exits", () => {
    const startFailure = new Error("taskkill missing");

    const failureFrom = (executeTaskkill: TaskkillExecutor) =>
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: {
          platform: "win32",
          executeTaskkill,
          signalProcess: () => null,
        },
      });

    expect(failureFrom(() => ({ error: startFailure, status: null }))).toBe(startFailure);
    expect(failureFrom(() => ({ status: 5 }))).toStrictEqual(
      new Error("taskkill exited with code 5"),
    );
    expect(failureFrom(() => ({ status: null }))).toStrictEqual(
      new Error("taskkill exited with code unknown"),
    );
  });

  test("the native taskkill invocation reports a nonexistent process as a failure", () => {
    expect(
      signalProcessTree({
        pid: 999_999_999,
        signal: "SIGTERM",
        dependencies: { platform: "win32" },
      }),
    ).toBeInstanceOf(Error);
  });

  test("POSIX signals the process group without touching the root separately", () => {
    const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(() => null);
    const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));

    expect(
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: { platform: "linux", signalProcess, executeTaskkill },
      }),
    ).toBeNull();
    expect(signalProcess).toHaveBeenCalledWith(-4321, "SIGTERM");
    expect(signalProcess).toHaveBeenCalledTimes(1);
    expect(executeTaskkill).not.toHaveBeenCalled();
  });

  test("Windows delegates the whole tree to taskkill", () => {
    const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(() => null);
    const executeTaskkill = vi.fn<TaskkillExecutor>(() => ({ status: 0 }));

    expect(
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: { platform: "win32", signalProcess, executeTaskkill },
      }),
    ).toBeNull();
    expect(executeTaskkill).toHaveBeenCalledOnce();
    expect(signalProcess).not.toHaveBeenCalled();
  });

  test("a tree failure falls back to the root and remains observable", () => {
    const groupFailure = new Error("group missing");
    const signalProcess = vi
      .fn<(pid: number, signal: NodeJS.Signals) => Error | null>()
      .mockReturnValueOnce(groupFailure)
      .mockReturnValueOnce(null);

    expect(
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: {
          platform: "darwin",
          signalProcess,
          executeTaskkill: () => ({ status: 0 }),
        },
      }),
    ).toBe(groupFailure);
    expect(signalProcess).toHaveBeenNthCalledWith(1, -4321, "SIGTERM");
    expect(signalProcess).toHaveBeenNthCalledWith(2, 4321, "SIGTERM");
  });

  test("POSIX treats a missing process group and root as an already completed shutdown", () => {
    class MissingProcessError extends Error {
      readonly code = "ESRCH";
    }
    const missing = new MissingProcessError("missing");

    expect(
      signalProcessTree({
        pid: 4321,
        signal: "SIGKILL",
        dependencies: {
          platform: "darwin",
          signalProcess: () => missing,
          executeTaskkill: () => ({ status: 0 }),
        },
      }),
    ).toBeNull();
  });

  test("Windows falls back to force-killing the root when taskkill fails", () => {
    const taskkillFailure = new Error("taskkill denied");
    const signalProcess = vi.fn<(pid: number, signal: NodeJS.Signals) => Error | null>(() => null);

    expect(
      signalProcessTree({
        pid: 4321,
        signal: "SIGTERM",
        dependencies: {
          platform: "win32",
          signalProcess,
          executeTaskkill: () => ({ error: taskkillFailure, status: null }),
        },
      }),
    ).toBe(taskkillFailure);
    expect(signalProcess).toHaveBeenCalledWith(4321, "SIGKILL");
  });

  test("failures from both tree and root termination are preserved", () => {
    const treeFailure = new Error("tree denied");
    const rootFailure = new Error("root denied");

    const failure = signalProcessTree({
      pid: 4321,
      signal: "SIGKILL",
      dependencies: {
        platform: "win32",
        signalProcess: () => rootFailure,
        executeTaskkill: () => ({ error: treeFailure, status: null }),
      },
    });

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toStrictEqual([treeFailure, rootFailure]);
  });
});
