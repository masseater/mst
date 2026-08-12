import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { attemptAsync } from "es-toolkit";

import { signalProcessTree } from "./process-tree.ts";
import {
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterruptHandler,
  makeRunningInterruptHandler,
  raiseSignal,
} from "./signals.ts";

import type { SlotHold } from "./slots.ts";
import type { Invocation } from "./usage.ts";

const KILL_GRACE_MS = 5_000;

type Settled =
  | { kind: "start-failure"; failure: Error }
  | { kind: "exit"; exitCode: number | null; bySignal: NodeJS.Signals | null };

type Verdict = { settled: Settled; timedOut: boolean };

type RunCommandDependencies = {
  platform: NodeJS.Platform;
  signalTree: (input: { pid: number; signal: NodeJS.Signals }) => Error | null;
};

const settledChild = (child: ChildProcess): Promise<Settled> =>
  new Promise((resolve) => {
    child.once("error", (failure) => {
      resolve({ kind: "start-failure", failure });
    });
    child.once("exit", (code, signal) => {
      resolve({ kind: "exit", exitCode: code, bySignal: signal });
    });
  });

const settledDelay = async (ms: number, cancel: AbortSignal): Promise<"elapsed" | "cancelled"> => {
  try {
    await delay(ms, undefined, { signal: cancel });
    return "elapsed";
  } catch (cancelledDelay) {
    return "cancelled";
  }
};

const timeoutFired = async (parameters: {
  childPid: number;
  timeoutMs: number;
  cancel: AbortSignal;
  dependencies: RunCommandDependencies;
}): Promise<{ fired: boolean; terminationFailure: Error | null }> => {
  const beforeTimeout = await settledDelay(parameters.timeoutMs, parameters.cancel);
  if (beforeTimeout === "cancelled") return { fired: false, terminationFailure: null };
  const firstSignal = parameters.dependencies.platform === "win32" ? "SIGKILL" : "SIGTERM";
  const terminationFailure = parameters.dependencies.signalTree({
    pid: parameters.childPid,
    signal: firstSignal,
  });
  if (parameters.dependencies.platform === "win32") {
    return { fired: true, terminationFailure };
  }
  await delay(KILL_GRACE_MS);
  const forcedFailure = parameters.dependencies.signalTree({
    pid: parameters.childPid,
    signal: "SIGKILL",
  });
  return { fired: true, terminationFailure: terminationFailure ?? forcedFailure };
};

const reportTreeTerminationFailure = (failure: Error): void => {
  process.stderr.write(
    `throttle: could not terminate the whole command tree: ${failure.message}\n`,
  );
};

const guardChild = async (input: {
  child: ChildProcess;
  invocation: Invocation;
  dependencies: RunCommandDependencies;
}): Promise<Verdict & { terminationFailure: Error | null }> => {
  const childPid = input.child.pid ?? 0;
  const runningHandler = makeRunningInterruptHandler({
    childPid,
    signalTree: input.dependencies.signalTree,
    reportFailure: reportTreeTerminationFailure,
  });
  installInterruptHandler(runningHandler);
  const canceller = new AbortController();
  const fired =
    input.invocation.timeoutSec === 0
      ? Promise.resolve({ fired: false, terminationFailure: null })
      : timeoutFired({
          childPid,
          timeoutMs: input.invocation.timeoutSec * 1000,
          cancel: canceller.signal,
          dependencies: input.dependencies,
        });
  const settled = await settledChild(input.child);
  canceller.abort();
  const timeout = await fired;
  dropInterruptHandler(runningHandler);
  return {
    settled,
    timedOut: timeout.fired,
    terminationFailure: timeout.terminationFailure,
  };
};

const reportChildEnd = (settled: Extract<Settled, { kind: "exit" }>): number => {
  if (settled.bySignal !== null) {
    process.stderr.write(`throttle: command was killed by ${settled.bySignal}\n`);
    return 1;
  }
  if (settled.exitCode !== 0) {
    process.stderr.write(`throttle: command failed with exit code ${settled.exitCode}\n`);
    return 1;
  }
  return 0;
};

const reportVerdict = (invocation: Invocation, verdict: Verdict): number => {
  if (verdict.settled.kind === "start-failure") {
    process.stderr.write(
      `throttle: could not start ${invocation.executable}: ${verdict.settled.failure.message}\n`,
    );
    return 1;
  }
  if (verdict.timedOut) {
    process.stderr.write(`throttle: killed: ran past the ${invocation.timeoutSec}s timeout\n`);
    return 1;
  }
  return reportChildEnd(verdict.settled);
};

const reportReleaseFailure = (failure: unknown): number => {
  const detail = failure instanceof Error ? failure.message : String(failure);
  process.stderr.write(`throttle: could not release the slot: ${detail}\n`);
  return 1;
};

const releaseFailureOf = async (hold: SlotHold): Promise<unknown> => {
  const [releaseFailure] = await attemptAsync(async () => {
    await hold.release();
    return true;
  });
  return releaseFailure;
};

const reportRunEnd = (input: {
  invocation: Invocation;
  verdict: Verdict & { terminationFailure: Error | null };
  releaseFailure: unknown;
}): number => {
  if (input.verdict.terminationFailure !== null) {
    reportTreeTerminationFailure(input.verdict.terminationFailure);
  }
  const verdictCode = reportVerdict(input.invocation, input.verdict);
  return input.releaseFailure === null ? verdictCode : reportReleaseFailure(input.releaseFailure);
};

export const runWithSlot = async (input: {
  invocation: Invocation;
  hold: SlotHold;
  dependencies?: RunCommandDependencies;
}): Promise<number> => {
  const dependencies = input.dependencies ?? {
    platform: process.platform,
    signalTree: signalProcessTree,
  };
  const heldHandler = makeHeldInterruptHandler({ release: input.hold.release, raise: raiseSignal });
  installInterruptHandler(heldHandler);
  process.stderr.write(`throttle: run ${input.invocation.commandLine}\n`);
  const child = spawn(input.invocation.executable, [...input.invocation.args], {
    detached: true,
    stdio: "inherit",
  });
  dropInterruptHandler(heldHandler);
  const verdict = await guardChild({ child, invocation: input.invocation, dependencies });
  const releaseFailure = await releaseFailureOf(input.hold);
  return reportRunEnd({ invocation: input.invocation, verdict, releaseFailure });
};
