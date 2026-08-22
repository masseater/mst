import { pullRequestAuthorLogin } from "../contract/extract.ts";
import { asRecord } from "../contract/unknown-record.ts";

import type { EventStore, EventSubscription, StoredEvent } from "./store.ts";

const byStoreOrder = (first: StoredEvent, second: StoredEvent): number => {
  if (first.receivedAtMs !== second.receivedAtMs) return first.receivedAtMs - second.receivedAtMs;
  if (first.id === second.id) return 0;
  return first.id < second.id ? -1 : 1;
};

const payloadPullNumber = (stored: StoredEvent): unknown =>
  asRecord(stored.payload.pull_request)?.number;

const AUTHOR_LOOKBACK = 10;

class MemoryEventStore implements EventStore {
  readonly #stampedNow: () => number;

  #eventsById: ReadonlyMap<string, StoredEvent> = new Map();

  #listeners: ReadonlySet<(added: StoredEvent) => void> = new Set();

  constructor(stampedNow: () => number) {
    this.#stampedNow = stampedNow;
  }

  readonly #liveEvents = (): readonly StoredEvent[] => {
    const currentMs = this.#stampedNow();
    return [...this.#eventsById.values()]
      .filter((storedEvent) => storedEvent.expiresAtMs > currentMs)
      .toSorted(byStoreOrder);
  };

  readonly #referencedEvent = (eventId: string): StoredEvent | undefined => {
    const storedEvent = this.#eventsById.get(eventId);
    return storedEvent !== undefined && storedEvent.expiresAtMs > this.#stampedNow()
      ? storedEvent
      : undefined;
  };

  readonly createIfAbsent = (stored: StoredEvent): Promise<StoredEvent> => {
    const existing = this.#eventsById.get(stored.id);
    if (existing !== undefined) return Promise.resolve(existing);
    const currentMs = this.#stampedNow();
    this.#eventsById = new Map<string, StoredEvent>([
      ...[...this.#eventsById].filter(([, storedEvent]) => storedEvent.expiresAtMs > currentMs),
      [stored.id, stored],
    ]);
    for (const listener of this.#listeners) listener(stored);
    return Promise.resolve(stored);
  };

  readonly readAfterId = (eventId: string): Promise<readonly StoredEvent[] | null> => {
    const reference = this.#referencedEvent(eventId);
    if (reference === undefined) return Promise.resolve(null);
    return Promise.resolve(
      this.#liveEvents().filter((storedEvent) => byStoreOrder(storedEvent, reference) > 0),
    );
  };

  readonly readSince = (sinceMs: number): Promise<readonly StoredEvent[]> =>
    Promise.resolve(
      this.#liveEvents().filter((storedEvent) => storedEvent.receivedAtMs >= sinceMs),
    );

  readonly subscribeAfterId = ({
    eventId,
    onAdd,
  }: {
    readonly eventId: string;
    readonly onAdd: (added: StoredEvent) => void;
  }): EventSubscription | null => {
    const reference = this.#referencedEvent(eventId);
    if (reference === undefined) return null;
    const listener = (added: StoredEvent): void => {
      if (byStoreOrder(added, reference) > 0) onAdd(added);
    };
    this.#listeners = new Set([...this.#listeners, listener]);
    return {
      unsubscribe: (): void => {
        this.#listeners = new Set(
          [...this.#listeners].filter((subscribed) => subscribed !== listener),
        );
      },
    };
  };

  readonly subscribeSince = ({
    sinceMs,
    onAdd,
  }: {
    readonly sinceMs: number;
    readonly onAdd: (added: StoredEvent) => void;
  }): EventSubscription => {
    const listener = (added: StoredEvent): void => {
      if (added.receivedAtMs >= sinceMs) onAdd(added);
    };
    this.#listeners = new Set([...this.#listeners, listener]);
    return {
      unsubscribe: (): void => {
        this.#listeners = new Set(
          [...this.#listeners].filter((subscribed) => subscribed !== listener),
        );
      },
    };
  };

  readonly findAuthorEvent = (prNumber: number): Promise<StoredEvent | null> => {
    const authorEvent = this.#liveEvents()
      .filter((storedEvent) => payloadPullNumber(storedEvent) === prNumber)
      .toSorted((first, second) => byStoreOrder(second, first))
      .slice(0, AUTHOR_LOOKBACK)
      .find((storedEvent) => pullRequestAuthorLogin(storedEvent.payload) !== undefined);
    return Promise.resolve(authorEvent ?? null);
  };

  readonly deleteForPr = ({
    prNumber,
    excludeDeliveryId,
  }: {
    readonly prNumber: number;
    readonly excludeDeliveryId: string;
  }): Promise<number> => {
    const retainedEvents = [...this.#eventsById].filter(
      ([, storedEvent]) =>
        payloadPullNumber(storedEvent) !== prNumber || storedEvent.deliveryId === excludeDeliveryId,
    );
    const deletedCount = this.#eventsById.size - retainedEvents.length;
    this.#eventsById = new Map(retainedEvents);
    return Promise.resolve(deletedCount);
  };
}

export const createMemoryEventStore = (stampedNow: () => number = Date.now): EventStore =>
  new MemoryEventStore(stampedNow);
