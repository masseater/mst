import { pullRequestAuthorLogin } from "../contract/extract.ts";
import { asRecord } from "../contract/unknown-record.ts";
import { CURSOR_TTL_MS } from "./durations.ts";

import type { CursorStore, EventStore, SessionStore, StoredEvent, StoredSession } from "./store.ts";

const byStoreOrder = (first: StoredEvent, second: StoredEvent): number => {
  if (first.receivedAtMs !== second.receivedAtMs) return first.receivedAtMs - second.receivedAtMs;
  if (first.id === second.id) return 0;
  return first.id < second.id ? -1 : 1;
};

const payloadPullNumber = (event: StoredEvent): unknown =>
  asRecord(event.payload.pull_request)?.number;

export const createMemoryEventStore = (now: () => number = Date.now): EventStore => {
  const eventsById = new Map<string, StoredEvent>();
  const listeners = new Set<(added: StoredEvent) => void>();

  const liveEvents = (): readonly StoredEvent[] => {
    const currentMs = now();
    return [...eventsById.values()]
      .filter((stored) => stored.expiresAtMs > currentMs)
      .toSorted(byStoreOrder);
  };

  const referencedEvent = (eventId: string): StoredEvent | undefined => {
    const stored = eventsById.get(eventId);
    return stored !== undefined && stored.expiresAtMs > now() ? stored : undefined;
  };

  return {
    createIfAbsent: (event) => {
      const existing = eventsById.get(event.id);
      if (existing !== undefined) return Promise.resolve(existing);
      const currentMs = now();
      for (const [id, stored] of eventsById) {
        if (stored.expiresAtMs <= currentMs) eventsById.delete(id);
      }
      eventsById.set(event.id, event);
      for (const listener of listeners) listener(event);
      return Promise.resolve(event);
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
      const targets = [...eventsById.values()].filter(
        (stored) =>
          payloadPullNumber(stored) === prNumber && stored.deliveryId !== excludeDeliveryId,
      );
      for (const target of targets) eventsById.delete(target.id);
      return Promise.resolve(targets.length);
    },
  };
};

export const createMemoryCursorStore = (now: () => number = Date.now): CursorStore => {
  const cursors = new Map<string, { readonly eventId: string; readonly expiresAtMs: number }>();
  return {
    read: (clientId) => {
      const cursor = cursors.get(clientId);
      if (cursor === undefined || cursor.expiresAtMs <= now()) return Promise.resolve(null);
      return Promise.resolve(cursor.eventId);
    },
    write: ({ clientId, eventId }) => {
      cursors.set(clientId, { eventId, expiresAtMs: now() + CURSOR_TTL_MS });
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
