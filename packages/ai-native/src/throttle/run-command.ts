import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { attemptAsync } from "es-toolkit";

import { CHILD_PROCESS_EVENT } from "../node-event-names.ts";
import { signalProcessTree, TREE_TERMINATION_SIGNAL } from "./process-tree.ts";
import { DELAY_ENDING, settledDelay } from "./settled-delay.ts";
import {
  dropInterruptHandler,
  installInterruptHandler,
  makeHeldInterrupt,
  makeRunningInterruptHandler,
  raiseSignal,
} from "./signals.ts";
import { warnUnreleased } from "./unreleased-warning.ts";

import type { SlotHold } from "./slots.ts";
import type { Invocation } from "./usage.ts";

const KILL_GRACE_MS = 5_000;

type Settled =
  | { kind: "start-failure"; failure: Error }
  | {
      kind: typeof CHILD_PROCESS_EVENT.exit;
      exitCode: number | null;
      bySignal: NodeJS.Signals | null;
    };

type Verdict = { settled: Settled; timedOut: boolean };

type RunCommandDependencies = {
  platform: NodeJS.Platform;
  signalTree: (input: { pid: number; signal: NodeJS.Signals }) => Error | null;
  spawnChild: (input: { executable: string; args: readonly string[] }) => ChildProcess;
};

const settledChild = (child: ChildProcess): Promise<Settled> =>
  new Promise((resolve) => {
    child.once(CHILD_PROCESS_EVENT.failure, (failure) => {
      resolve({ kind: "start-failure", failure });
    });
    child.once(CHILD_PROCESS_EVENT.exit, (code, signal) => {
      resolve({ kind: CHILD_PROCESS_EVENT.exit, exitCode: code, bySignal: signal });
    });
  });

const timeoutFired = async (parameters: {
  childPid: number;
  timeoutMs: number;
  cancel: AbortSignal;
  dependencies: RunCommandDependencies;
}): Promise<{ fired: boolean; terminationFailure: Error | null }> => {
  const beforeTimeout = await settledDelay(parameters.timeoutMs, parameters.cancel);
  if (beforeTimeout === DELAY_ENDING.cancelled) return { fired: false, terminationFailure: null };
  const firstSignal =
    parameters.dependencies.platform === "win32"
      ? TREE_TERMINATION_SIGNAL.forced
      : TREE_TERMINATION_SIGNAL.graceful;
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
    signal: TREE_TERMINATION_SIGNAL.forced,
  });
  return { fired: true, terminationFailure: terminationFailure ?? forcedFailure };
};

const reportTreeTerminationFailure = (failure: Error): void => {
  process.stderr.write(
    `throttle: could not terminate the whole command tree: ${failure.message}\n`,
  );
};

const guardChild = async (input: {
  childPid: number;
  settling: Promise<Settled>;
  invocation: Invocation;
  dependencies: RunCommandDependencies;
}): Promise<Verdict & { terminationFailure: Error | null }> => {
  const runningHandler = makeRunningInterruptHandler({
    childPid: input.childPid,
    signalTree: input.dependencies.signalTree,
    reportFailure: reportTreeTerminationFailure,
  });
  installInterruptHandler(runningHandler);
  const canceller = new AbortController();
  const fired =
    input.invocation.timeoutSec === 0
      ? Promise.resolve({ fired: false, terminationFailure: null })
      : timeoutFired({
          childPid: input.childPid,
          timeoutMs: input.invocation.timeoutSec * 1000,
          cancel: canceller.signal,
          dependencies: input.dependencies,
        });
  const settled = await input.settling;
  canceller.abort();
  const timeout = await fired;
  dropInterruptHandler(runningHandler);
  return {
    settled,
    timedOut: timeout.fired,
    terminationFailure: timeout.terminationFailure,
  };
};

const reportChildEnd = (
  settled: Extract<Settled, { kind: typeof CHILD_PROCESS_EVENT.exit }>,
): number => {
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

const spawnUnderHeldInterrupt = async (input: {
  invocation: Invocation;
  hold: SlotHold;
  dependencies: RunCommandDependencies;
}): Promise<{ childPid: number; settling: Promise<Settled> }> => {
  const held = makeHeldInterrupt({
    release: input.hold.release,
    raise: raiseSignal,
    onUnreleased: warnUnreleased,
  });
  installInterruptHandler(held.handler);
  process.stderr.write(`throttle: run ${input.invocation.commandLine}\n`);
  const child = input.dependencies.spawnChild({
    executable: input.invocation.executable,
    args: input.invocation.args,
  });
  const settling = settledChild(child);
  dropInterruptHandler(held.handler);
  held.standDown();
  await held.settled;
  return { childPid: child.pid ?? 0, settling };
};

export const runWithSlot = async (input: {
  invocation: Invocation;
  hold: SlotHold;
  dependencies?: Partial<RunCommandDependencies>;
}): Promise<number> => {
  const dependencies: RunCommandDependencies = {
    platform: input.dependencies?.platform ?? process.platform,
    signalTree: input.dependencies?.signalTree ?? signalProcessTree,
    spawnChild:
      input.dependencies?.spawnChild ??
      ((invocation) =>
        spawn(invocation.executable, [...invocation.args], {
          detached: true,
          stdio: "inherit",
        })),
  };
  const startedCommand = await spawnUnderHeldInterrupt({
    invocation: input.invocation,
    hold: input.hold,
    dependencies,
  });
  const verdict = await guardChild({
    childPid: startedCommand.childPid,
    settling: startedCommand.settling,
    invocation: input.invocation,
    dependencies,
  });
  const releaseFailure = await releaseFailureOf(input.hold);
  return reportRunEnd({ invocation: input.invocation, verdict, releaseFailure });
};
