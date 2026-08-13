import { KEEPALIVE_INTERVAL_MS } from "./durations.ts";
import { readResumableEvents, toEnvelope } from "./poll.ts";

import type { Logger } from "../logging/logger.ts";
import type { OwnerFilter } from "./owner-filter.ts";
import type { CursorStore, EventStore, StoredEvent } from "./store.ts";

export type SseSink = {
  readonly writeEvent: (frame: {
    readonly eventType: string;
    readonly eventId: string;
    readonly envelopeJson: string;
  }) => void;
  readonly writeKeepalive: () => void;
};

export type EventStreamRequest = {
  readonly clientId: string;
  readonly subscriberLogin: string;
  readonly lastEventId: string | null;
  readonly events: EventStore;
  readonly cursors: CursorStore;
  readonly ownerFilter: OwnerFilter;
  readonly sink: SseSink;
  readonly clientAbort: AbortSignal;
  readonly log: Logger;
  readonly now?: () => number;
  readonly keepaliveMs?: number;
  readonly knownIdLimit?: number;
};

const KNOWN_ID_LIMIT = 1000;

const nonEmpty = (candidate: string | null): string | null =>
  candidate !== null && candidate !== "" ? candidate : null;

const resolveResumePosition = async (resumption: {
  readonly lastEventId: string | null;
  readonly cursors: CursorStore;
  readonly clientId: string;
}): Promise<string | null> => {
  const fromHeader = nonEmpty(resumption.lastEventId);
  if (fromHeader !== null) return fromHeader;
  return nonEmpty(await resumption.cursors.read(resumption.clientId));
};

type StreamLifecycle = {
  readonly halted: AbortSignal;
  readonly stop: () => void;
  readonly closed: Promise<void>;
  readonly onStop: (cleanup: () => void) => void;
};

const createStreamLifecycle = (stream: EventStreamRequest): StreamLifecycle => {
  const halt = new AbortController();
  const closed = new Promise<void>((resolve) => {
    halt.signal.addEventListener(
      "abort",
      () => {
        resolve();
      },
      { once: true },
    );
  });
  stream.clientAbort.addEventListener(
    "abort",
    () => {
      stream.log.info({ clientId: stream.clientId }, "client disconnected");
      halt.abort();
    },
    { once: true },
  );
  return {
    halted: halt.signal,
    stop: () => {
      halt.abort();
    },
    closed,
    onStop: (cleanup) => {
      halt.signal.addEventListener("abort", cleanup, { once: true });
    },
  };
};

const deliverStoredEvent = async (delivery: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly sent: StoredEvent;
}): Promise<void> => {
  const owned = await delivery.stream.ownerFilter.owns({
    stored: delivery.sent,
    subscriberLogin: delivery.stream.subscriberLogin,
  });
  if (!owned || delivery.lifecycle.halted.aborted) return;
  delivery.stream.sink.writeEvent({
    eventType: delivery.sent.eventType,
    eventId: delivery.sent.id,
    envelopeJson: JSON.stringify(toEnvelope(delivery.sent)),
  });
  delivery.stream.log.info(
    {
      clientId: delivery.stream.clientId,
      eventId: delivery.sent.id,
      deliveryId: delivery.sent.deliveryId,
    },
    "delivered sent event",
  );
  await delivery.stream.cursors.write({
    clientId: delivery.stream.clientId,
    eventId: delivery.sent.id,
  });
};

const deliverInOrder = async (run: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly queued: readonly StoredEvent[];
  readonly failureNote: string;
}): Promise<boolean> => {
  const [sent, ...following] = run.queued;
  if (sent === undefined) return true;
  if (run.lifecycle.halted.aborted) return false;
  try {
    await deliverStoredEvent({ stream: run.stream, lifecycle: run.lifecycle, sent });
  } catch (failure) {
    run.stream.log.warn(
      { clientId: run.stream.clientId, eventId: sent.id, err: failure },
      run.failureNote,
    );
    run.lifecycle.stop();
    return false;
  }
  return deliverInOrder({ ...run, queued: following });
};

const boundedKnownIds = (remembered: readonly string[], knownIdLimit: number): readonly string[] =>
  remembered.slice(remembered.length - knownIdLimit);

const readOnArrival = async (waiting: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly sinceMs: number;
  readonly afterId: string | null;
  readonly knownIds: readonly string[];
}): Promise<readonly StoredEvent[]> => {
  const wakeup = Promise.withResolvers<undefined>();
  const subscription = waiting.stream.events.subscribeSince({
    sinceMs: waiting.sinceMs,
    onAdd: () => {
      wakeup.resolve(undefined);
    },
  });
  const arrived = await readResumableEvents({
    events: waiting.stream.events,
    resumeAfterId: waiting.afterId,
    nowMs: waiting.sinceMs,
  });
  if (!arrived.some((added) => !waiting.knownIds.includes(added.id))) {
    await Promise.race([wakeup.promise, waiting.lifecycle.closed]);
  }
  subscription.unsubscribe();
  return arrived;
};

const runLiveWatch = async (watch: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly sinceMs: number;
  readonly knownIdLimit: number;
  readonly afterId: string | null;
  readonly knownIds: readonly string[];
}): Promise<void> => {
  if (watch.lifecycle.halted.aborted) return;
  const arrived = await readOnArrival(watch);
  const unseen = arrived.filter((added) => !watch.knownIds.includes(added.id));
  const advanced = {
    ...watch,
    afterId: arrived.at(-1)?.id ?? watch.afterId,
    knownIds: boundedKnownIds(
      [...watch.knownIds, ...unseen.map((added) => added.id)],
      watch.knownIdLimit,
    ),
  };
  for (const added of unseen) {
    watch.stream.ownerFilter.remember(added);
    watch.stream.ownerFilter.discardIfClosed(added);
  }
  const delivered = await deliverInOrder({
    stream: watch.stream,
    lifecycle: watch.lifecycle,
    queued: unseen,
    failureNote: "live delivery failed; stopping stream",
  });
  if (!delivered) return;
  return runLiveWatch(advanced);
};

const startKeepalive = (keepalive: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
}): void => {
  const keepaliveTimer = setInterval(() => {
    try {
      keepalive.stream.sink.writeKeepalive();
    } catch (writeFailure) {
      keepalive.stream.log.warn(
        { clientId: keepalive.stream.clientId, err: writeFailure },
        "keepalive write failed; stopping stream",
      );
      keepalive.lifecycle.stop();
    }
  }, keepalive.stream.keepaliveMs ?? KEEPALIVE_INTERVAL_MS);
  keepalive.lifecycle.onStop(() => {
    clearInterval(keepaliveTimer);
  });
};

const logConnected = (connection: {
  readonly stream: EventStreamRequest;
  readonly resumeAfterId: string | null;
  readonly backlogCount: number;
}): void => {
  connection.stream.log.info(
    {
      clientId: connection.stream.clientId,
      ghUser: connection.stream.subscriberLogin,
      lastEventId: connection.stream.lastEventId,
      resumeAfterId: connection.resumeAfterId,
      backlogCount: connection.backlogCount,
    },
    "event stream connected",
  );
};

const replayBacklog = (replay: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly backlog: readonly StoredEvent[];
}): Promise<boolean> => {
  for (const sent of replay.backlog) replay.stream.ownerFilter.remember(sent);
  return deliverInOrder({
    stream: replay.stream,
    lifecycle: replay.lifecycle,
    queued: replay.backlog,
    failureNote: "backlog delivery failed; stopping stream",
  });
};

const openDelivery = (opened: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly backlog: readonly StoredEvent[];
  readonly resumeAfterId: string | null;
  readonly sinceMs: number;
}): Promise<void> => {
  startKeepalive({ stream: opened.stream, lifecycle: opened.lifecycle });
  const knownIdLimit = opened.stream.knownIdLimit ?? KNOWN_ID_LIMIT;
  return runLiveWatch({
    stream: opened.stream,
    lifecycle: opened.lifecycle,
    sinceMs: opened.sinceMs,
    knownIdLimit,
    afterId: opened.backlog.at(-1)?.id ?? opened.resumeAfterId,
    knownIds: boundedKnownIds(
      opened.backlog.map((sent) => sent.id),
      knownIdLimit,
    ),
  });
};

export const runEventStream = async (stream: EventStreamRequest): Promise<void> => {
  const nowMs = (stream.now ?? Date.now)();
  const resumeAfterId = await resolveResumePosition({
    lastEventId: stream.lastEventId,
    cursors: stream.cursors,
    clientId: stream.clientId,
  });
  const backlog = await readResumableEvents({ events: stream.events, resumeAfterId, nowMs });
  logConnected({ stream, resumeAfterId, backlogCount: backlog.length });
  const lifecycle = createStreamLifecycle(stream);
  const replayed = await replayBacklog({ stream, lifecycle, backlog });
  if (!replayed) return lifecycle.closed;
  await openDelivery({ stream, lifecycle, backlog, resumeAfterId, sinceMs: nowMs });
  return lifecycle.closed;
};
