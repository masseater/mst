import {
  runConnectionCycle,
  STREAM_ENDED,
  type CycleOutcome,
} from "../runtime/connection-cycle.ts";
import { backoffAfterFailures, needsOperatorIntervention } from "../runtime/cycle-backoff.ts";
import { registerShutdown } from "../runtime/shutdown.ts";

import type { Mode } from "../contract/vocabulary.ts";
import type { ComposedRuntime } from "../runtime/compose-runtime.ts";
import type { IdleMonitor } from "../runtime/idle-monitor.ts";
import type { RestartRequest } from "../runtime/restart-request.ts";

const CYCLE_RESTART_DELAY_MS = 3_000;

export type CycleLoop = {
  readonly mode: Mode;
  readonly runtime: Pick<
    ComposedRuntime,
    | "log"
    | "syncToMain"
    | "drainStartup"
    | "connect"
    | "subscribe"
    | "dispatcher"
    | "queue"
    | "disconnect"
    | "remoteHeadCommit"
  >;
  readonly restart: RestartRequest;
  readonly idleMonitor: IdleMonitor;
  readonly baseline: Map<string, string>;
};

const runOneCycle = async (
  cycling: CycleLoop & { readonly signalled: () => boolean },
): Promise<CycleOutcome> => {
  const { runtime } = cycling;
  const commit = await runtime.remoteHeadCommit();
  if (commit === null) throw new Error("the tracked remote branch resolved to no commit");
  cycling.baseline.set("commit", commit);
  return runConnectionCycle({
    mode: cycling.mode,
    syncMain: () => runtime.syncToMain(),
    startupDrain: () => runtime.drainStartup(),
    connect: () => runtime.connect(),
    subscribe: () => runtime.subscribe(),
    dispatcher: runtime.dispatcher,
    queue: runtime.queue,
    restart: cycling.restart,
    onActivity: () => {
      cycling.idleMonitor.recordActivity();
    },
    signalled: cycling.signalled,
    log: runtime.log,
  });
};

const delayAfterFailure = (failing: {
  readonly cycling: CycleLoop;
  readonly failures: Map<string, number>;
  readonly cycleFailure: unknown;
}): number => {
  if (needsOperatorIntervention(failing.cycleFailure)) throw failing.cycleFailure;
  const consecutiveFailures = (failing.failures.get("consecutive") ?? 0) + 1;
  failing.failures.set("consecutive", consecutiveFailures);
  const backoffMs = backoffAfterFailures({ consecutiveFailures, random: Math.random });
  failing.cycling.runtime.log.error(
    {
      mode: failing.cycling.mode,
      backoffMs,
      consecutiveFailures,
      err: failing.cycleFailure,
    },
    "the connection cycle failed; retrying after a backoff",
  );
  return backoffMs;
};

const delayBeforeNextCycle = async (repeating: {
  readonly cycling: CycleLoop & { readonly signalled: () => boolean };
  readonly failures: Map<string, number>;
}): Promise<number | null> => {
  const { cycling, failures } = repeating;
  try {
    const ending = await runOneCycle(cycling);
    if (ending !== STREAM_ENDED) return null;
    cycling.runtime.log.warn({ ending }, "the connection cycle ended; reconnecting shortly");
    failures.set("consecutive", 0);
    return CYCLE_RESTART_DELAY_MS;
  } catch (cycleFailure) {
    return delayAfterFailure({ cycling, failures, cycleFailure });
  }
};

const repeatCycles = async (
  cycling: CycleLoop & { readonly signalled: () => boolean },
): Promise<void> => {
  const failures = new Map<string, number>();
  for (;;) {
    const delayMs = await delayBeforeNextCycle({ cycling, failures });
    if (delayMs === null) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
};

export const cycleUntilStopped = async (cycling: CycleLoop): Promise<void> => {
  const { runtime } = cycling;
  const stopped = new Map([["signalled", false]]);
  const shutdown = registerShutdown({
    target: process,
    onSignal: () => {
      stopped.set("signalled", true);
      runtime.disconnect();
    },
    log: runtime.log,
  });
  try {
    await repeatCycles({ ...cycling, signalled: () => stopped.get("signalled") === true });
  } finally {
    shutdown.release();
  }
};
