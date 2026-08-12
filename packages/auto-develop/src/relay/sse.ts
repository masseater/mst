import { KEEPALIVE_INTERVAL_MS } from "./durations.ts";
import { readResumableEvents, toEnvelope } from "./poll.ts";

import type { Logger } from "../logging/logger.ts";
import type { OwnerFilter } from "./owner-filter.ts";
import type { CursorStore, EventStore, EventSubscription, StoredEvent } from "./store.ts";

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
  readonly onStop: (name: string, cleanup: () => void) => void;
};

const createStreamLifecycle = (stream: EventStreamRequest): StreamLifecycle => {
  const halt = new AbortController();
  const cleanups = new Map<string, () => void>();
  const closed = new Promise<void>((resolve) => {
    halt.signal.addEventListener(
      "abort",
      () => {
        resolve();
      },
      { once: true },
    );
  });
  halt.signal.addEventListener(
    "abort",
    () => {
      for (const cleanup of cleanups.values()) cleanup();
    },
    { once: true },
  );
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
    onStop: (name, cleanup) => {
      cleanups.set(name, cleanup);
    },
  };
};

type DeliveryEngine = {
  readonly replayBacklog: (backlog: readonly StoredEvent[]) => Promise<boolean>;
  readonly enqueueLiveEvent: (added: StoredEvent) => void;
};

const createLiveQueue = (
  deliver: (added: StoredEvent) => Promise<void>,
): { readonly enqueue: (added: StoredEvent) => void } => {
  const pendingEvents = new Map<number, StoredEvent>();
  const queueCounters = new Map<string, number>([
    ["head", 0],
    ["tail", 0],
    ["running", 0],
  ]);

  const takeNextLiveEvent = (): StoredEvent | null => {
    const head = queueCounters.get("head") as number;
    if (head >= (queueCounters.get("tail") as number)) return null;
    const nextEvent = pendingEvents.get(head) as StoredEvent;
    pendingEvents.delete(head);
    queueCounters.set("head", head + 1);
    return nextEvent;
  };

  const drainLiveQueue = async (): Promise<void> => {
    if (queueCounters.get("running") === 1) return;
    queueCounters.set("running", 1);
    try {
      for (;;) {
        const nextEvent = takeNextLiveEvent();
        if (nextEvent === null) break;
        await deliver(nextEvent);
      }
    } finally {
      queueCounters.set("running", 0);
    }
  };

  return {
    enqueue: (added) => {
      const tail = queueCounters.get("tail") as number;
      pendingEvents.set(tail, added);
      queueCounters.set("tail", tail + 1);
      void drainLiveQueue();
    },
  };
};

const createDeliveryEngine = (engine: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
}): DeliveryEngine => {
  const { stream, lifecycle } = engine;
  const knownIds = new Set<string>();
  const knownIdLimit = stream.knownIdLimit ?? KNOWN_ID_LIMIT;

  const rememberKnownId = (eventId: string): void => {
    knownIds.add(eventId);
    for (const oldestId of knownIds) {
      if (knownIds.size <= knownIdLimit) break;
      knownIds.delete(oldestId);
    }
  };

  const deliverStoredEvent = async (stored: StoredEvent): Promise<void> => {
    const owned = await stream.ownerFilter.owns({
      event: stored,
      subscriberLogin: stream.subscriberLogin,
    });
    if (!owned || lifecycle.halted.aborted) return;
    stream.sink.writeEvent({
      eventType: stored.eventType,
      eventId: stored.id,
      envelopeJson: JSON.stringify(toEnvelope(stored)),
    });
    stream.log.info(
      { clientId: stream.clientId, eventId: stored.id, deliveryId: stored.deliveryId },
      "delivered stored event",
    );
    await stream.cursors.write({ clientId: stream.clientId, eventId: stored.id });
  };

  const deliverOrStop = async (stored: StoredEvent): Promise<boolean> => {
    try {
      await deliverStoredEvent(stored);
      return true;
    } catch (failure) {
      stream.log.warn(
        { clientId: stream.clientId, eventId: stored.id, err: failure },
        "backlog delivery failed; stopping stream",
      );
      lifecycle.stop();
      return false;
    }
  };

  const deliverLiveEvent = async (added: StoredEvent): Promise<void> => {
    if (lifecycle.halted.aborted || knownIds.has(added.id)) return;
    rememberKnownId(added.id);
    stream.ownerFilter.remember(added);
    stream.ownerFilter.discardIfClosed(added);
    await deliverStoredEvent(added);
  };

  const deliverLiveEventSafely = async (added: StoredEvent): Promise<void> => {
    try {
      await deliverLiveEvent(added);
    } catch (failure) {
      stream.log.warn(
        { clientId: stream.clientId, eventId: added.id, err: failure },
        "live delivery failed; stopping stream",
      );
      lifecycle.stop();
    }
  };

  const liveQueue = createLiveQueue(deliverLiveEventSafely);

  return {
    replayBacklog: async (backlog) => {
      for (const stored of backlog) {
        stream.ownerFilter.remember(stored);
        rememberKnownId(stored.id);
      }
      for (const stored of backlog) {
        if (lifecycle.halted.aborted) return false;
        const delivered = await deliverOrStop(stored);
        if (!delivered) return false;
      }
      return true;
    },
    enqueueLiveEvent: liveQueue.enqueue,
  };
};

const startLiveWatch = (watch: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly engine: DeliveryEngine;
  readonly backlog: readonly StoredEvent[];
  readonly resumeAfterId: string | null;
  readonly sinceMs: number;
}): void => {
  const watchAfterId = watch.backlog.at(-1)?.id ?? watch.resumeAfterId;
  const fromId =
    watchAfterId === null
      ? null
      : watch.stream.events.subscribeAfterId({
          eventId: watchAfterId,
          onAdd: watch.engine.enqueueLiveEvent,
        });
  const subscription: EventSubscription =
    fromId ??
    watch.stream.events.subscribeSince({
      sinceMs: watch.sinceMs,
      onAdd: watch.engine.enqueueLiveEvent,
    });
  watch.lifecycle.onStop("subscription", () => {
    subscription.unsubscribe();
  });
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
  keepalive.lifecycle.onStop("keepalive", () => {
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

const openDelivery = async (opened: {
  readonly stream: EventStreamRequest;
  readonly lifecycle: StreamLifecycle;
  readonly backlog: readonly StoredEvent[];
  readonly resumeAfterId: string | null;
  readonly sinceMs: number;
}): Promise<void> => {
  const engine = createDeliveryEngine({ stream: opened.stream, lifecycle: opened.lifecycle });
  const replayed = await engine.replayBacklog(opened.backlog);
  if (!replayed) return;
  startLiveWatch({ ...opened, engine });
  startKeepalive({ stream: opened.stream, lifecycle: opened.lifecycle });
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
  await openDelivery({ stream, lifecycle, backlog, resumeAfterId, sinceMs: nowMs });
  return lifecycle.closed;
};
