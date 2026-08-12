import { pullRequestAuthorLogin } from "../contract/extract.ts";
import { asRecord } from "../contract/unknown-record.ts";
import { CURSOR_TTL_MS } from "./durations.ts";

import type { CursorStore, EventStore, SessionStore, StoredEvent, StoredSession } from "./store.ts";

const byStoreOrder = (first: StoredEvent, second: StoredEvent): number => {
  if (first.receivedAtMs !== second.receivedAtMs) return first.receivedAtMs - second.receivedAtMs;
  if (first.id === second.id) return 0;
  return first.id < second.id ? -1 : 1;
};

const payloadPullNumber = (stored: StoredEvent): unknown =>
  asRecord(stored.payload.pull_request)?.number;

export const createMemoryEventStore = (stampedNow: () => number = Date.now): EventStore => {
  const eventsById = new Map<string, StoredEvent>();
  const listeners = new Set<(added: StoredEvent) => void>();

  const liveEvents = (): readonly StoredEvent[] => {
    const currentMs = stampedNow();
    return [...eventsById.values()]
      .filter((stored) => stored.expiresAtMs > currentMs)
      .toSorted(byStoreOrder);
  };

  const referencedEvent = (eventId: string): StoredEvent | undefined => {
    const stored = eventsById.get(eventId);
    return stored !== undefined && stored.expiresAtMs > stampedNow() ? stored : undefined;
  };

  return {
    createIfAbsent: (stored) => {
      const existing = eventsById.get(stored.id);
      if (existing !== undefined) return Promise.resolve(existing);
      const currentMs = stampedNow();
      for (const [identity, stored] of eventsById) {
        if (stored.expiresAtMs <= currentMs) eventsById.delete(identity);
      }
      eventsById.set(stored.id, stored);
      for (const listener of listeners) listener(stored);
      return Promise.resolve(stored);
    },
    readAfterId: (eventId) => {
      const reference = referencedEvent(eventId);
      if (reference === undefined) return Promise.resolve(null);
      return Promise.resolve(liveEvents().filter((stored) => byStoreOrder(stored, reference) > 0));
    },
    readSince: (sinceMs) =>
      Promise.resolve(liveEvents().filter((stored) => stored.receivedAtMs >= sinceMs)),
    subscribeAfterId: ({ eventId, onAdd }) => {
      const reference = referencedEvent(eventId);
      if (reference === undefined) return null;
      const listener = (added: StoredEvent): void => {
        if (byStoreOrder(added, reference) > 0) onAdd(added);
      };
      listeners.add(listener);
      return {
        unsubscribe: (): void => {
          listeners.delete(listener);
        },
      };
    },
    subscribeSince: ({ sinceMs, onAdd }) => {
      const listener = (added: StoredEvent): void => {
        if (added.receivedAtMs >= sinceMs) onAdd(added);
      };
      listeners.add(listener);
      return {
        unsubscribe: (): void => {
          listeners.delete(listener);
        },
      };
    },
    findAuthorEvent: (prNumber) => {
      const authorEvent = liveEvents()
        .filter((stored) => payloadPullNumber(stored) === prNumber)
        .toSorted((first, second) => byStoreOrder(second, first))
        .slice(0, 10)
        .find((stored) => pullRequestAuthorLogin(stored.payload) !== undefined);
      return Promise.resolve(authorEvent ?? null);
    },
    deleteForPr: ({ prNumber, excludeDeliveryId }) => {
      const checkedTargets = [...eventsById.values()].filter(
        (stored) =>
          payloadPullNumber(stored) === prNumber && stored.deliveryId !== excludeDeliveryId,
      );
      for (const checked of checkedTargets) eventsById.delete(checked.id);
      return Promise.resolve(checkedTargets.length);
    },
  };
};

export const createMemoryCursorStore = (stampedNow: () => number = Date.now): CursorStore => {
  const cursors = new Map<string, { readonly eventId: string; readonly expiresAtMs: number }>();
  return {
    read: (clientId) => {
      const cursor = cursors.get(clientId);
      if (cursor === undefined || cursor.expiresAtMs <= stampedNow()) return Promise.resolve(null);
      return Promise.resolve(cursor.eventId);
    },
    write: ({ clientId, eventId }) => {
      cursors.set(clientId, { eventId, expiresAtMs: stampedNow() + CURSOR_TTL_MS });
      return Promise.resolve();
    },
  };
};

export const createMemorySessionStore = (): SessionStore => {
  const sessions = new Map<string, StoredSession>();
  return {
    save: ({ digest, login, expiresAtMs }) => {
      sessions.set(digest, { login, expiresAtMs });
      return Promise.resolve();
    },
    resolve: (digest) => Promise.resolve(sessions.get(digest) ?? null),
  };
};
