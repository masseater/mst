import { filterEvent } from "../contract/filter.ts";

import type { Mode } from "../contract/vocabulary.ts";
import type { Logger } from "../logging/logger.ts";
import type { JobQueue } from "../queue/job-queue.ts";
import type { EventDispatcher } from "./event-dispatch.ts";
import type { RestartRequest } from "./restart-request.ts";

const CYCLE_OUTCOMES = ["restart-requested", "signalled", "stream-ended"] as const;

export type CycleOutcome = (typeof CYCLE_OUTCOMES)[number];

const RESTART_REQUESTED: CycleOutcome = "restart-requested";

const SIGNALLED: CycleOutcome = "signalled";

export const STREAM_ENDED: CycleOutcome = "stream-ended";

export type ConnectionCycleConfig = {
  readonly mode: Mode;
  readonly syncMain: () => Promise<void>;
  readonly startupDrain: () => Promise<readonly Readonly<Record<string, unknown>>[]>;
  readonly connect: () => Promise<void>;
  readonly subscribe: () => AsyncGenerator<Readonly<Record<string, unknown>>, void, undefined>;
  readonly dispatcher: EventDispatcher;
  readonly queue: JobQueue;
  readonly restart: RestartRequest;
  readonly onActivity: () => void;
  readonly signalled: () => boolean;
  readonly log: Logger;
};

const dispatchAll = (dispatching: {
  readonly events: readonly Readonly<Record<string, unknown>>[];
  readonly dispatcher: EventDispatcher;
  readonly mode: Mode;
}): number => {
  const dispatched = dispatching.events.flatMap((raw) => {
    const filteredOnes = filterEvent(raw, dispatching.mode);
    return filteredOnes === null ? [] : [dispatching.dispatcher.dispatch(filteredOnes)];
  });
  return dispatched.filter(Boolean).length;
};

const consumeStream = async (config: ConnectionCycleConfig): Promise<CycleOutcome | null> => {
  for await (const raw of config.subscribe()) {
    config.onActivity();
    const filteredOnes = filterEvent(raw, config.mode);
    if (filteredOnes !== null) config.dispatcher.dispatch(filteredOnes);
    if (config.signalled()) return SIGNALLED;
    if (config.restart.requested() !== null) return RESTART_REQUESTED;
  }
  if (config.signalled()) return SIGNALLED;
  return config.restart.requested() === null ? null : RESTART_REQUESTED;
};

const dispatchStartupDrain = async (config: ConnectionCycleConfig): Promise<void> => {
  const drained = await config.startupDrain();
  const accepted = dispatchAll({
    events: drained,
    dispatcher: config.dispatcher,
    mode: config.mode,
  });
  config.log.info({ drained: drained.length, accepted }, "startup drain dispatched");
};

export const runConnectionCycle = async (config: ConnectionCycleConfig): Promise<CycleOutcome> => {
  await config.syncMain();
  await dispatchStartupDrain(config);
  const connection = config.connect();
  const stopReason = await consumeStream(config);
  await connection;
  if (stopReason !== null) return stopReason;
  await config.queue.drain();
  return STREAM_ENDED;
};
