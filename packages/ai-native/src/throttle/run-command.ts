import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import {
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterruptHandler,
  makeRunningInterruptHandler,
  raiseSignal,
  safeKill,
} from "./signals.ts";

import type { SlotHold } from "./slots.ts";
import type { Invocation } from "./usage.ts";

const KILL_GRACE_MS = 5_000;

type Settled =
  | { kind: "start-failure"; failure: Error }
  | { kind: "exit"; exitCode: number | null; bySignal: NodeJS.Signals | null };

type Verdict = { settled: Settled; timedOut: boolean };

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
}): Promise<boolean> => {
  const beforeTimeout = await settledDelay(parameters.timeoutMs, parameters.cancel);
  if (beforeTimeout === "cancelled") return false;
  safeKill(-parameters.childPid, "SIGTERM");
  const beforeKill = await settledDelay(KILL_GRACE_MS, parameters.cancel);
  if (beforeKill === "elapsed") safeKill(-parameters.childPid, "SIGKILL");
  return true;
};

const guardChild = async (child: ChildProcess, invocation: Invocation): Promise<Verdict> => {
  const childPid = child.pid ?? 0;
  const runningHandler = makeRunningInterruptHandler({ childPid, kill: safeKill });
  installInterruptHandler(runningHandler);
  const canceller = new AbortController();
  const fired =
    invocation.timeoutSec === 0
      ? Promise.resolve(false)
      : timeoutFired({
          childPid,
          timeoutMs: invocation.timeoutSec * 1000,
          cancel: canceller.signal,
        });
  const settled = await settledChild(child);
  canceller.abort();
  const timedOut = await fired;
  dropInterruptHandler(runningHandler);
  return { settled, timedOut };
};

export const releaseQuietly = async (release: () => Promise<void>): Promise<void> => {
  try {
    await release();
  } catch (staleRelease) {
    return;
  }
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

export const runWithSlot = async (invocation: Invocation, hold: SlotHold): Promise<number> => {
  const heldHandler = makeHeldInterruptHandler({ release: hold.release, raise: raiseSignal });
  installInterruptHandler(heldHandler);
  process.stderr.write(`throttle: run ${invocation.commandLine}\n`);
  const child = spawn(invocation.executable, [...invocation.args], {
    detached: true,
    stdio: "inherit",
  });
  dropInterruptHandler(heldHandler);
  const verdict = await guardChild(child, invocation);
  await releaseQuietly(hold.release);
  return reportVerdict(invocation, verdict);
};
