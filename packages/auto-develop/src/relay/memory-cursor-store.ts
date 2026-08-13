import { CURSOR_TTL_MS } from "./durations.ts";

import type { CursorStore } from "./store.ts";

type StoredCursor = { readonly eventId: string; readonly expiresAtMs: number };

class MemoryCursorStore implements CursorStore {
  readonly #stampedNow: () => number;

  #cursors: ReadonlyMap<string, StoredCursor> = new Map();

  constructor(stampedNow: () => number) {
    this.#stampedNow = stampedNow;
  }

  readonly read = (clientId: string): Promise<string | null> => {
    const cursor = this.#cursors.get(clientId);
    if (cursor === undefined || cursor.expiresAtMs <= this.#stampedNow()) {
      return Promise.resolve(null);
    }
    return Promise.resolve(cursor.eventId);
  };

  readonly write = ({
    clientId,
    eventId,
  }: {
    readonly clientId: string;
    readonly eventId: string;
  }): Promise<void> => {
    this.#cursors = new Map<string, StoredCursor>([
      ...this.#cursors,
      [clientId, { eventId, expiresAtMs: this.#stampedNow() + CURSOR_TTL_MS }],
    ]);
    return Promise.resolve();
  };
}

export const createMemoryCursorStore = (stampedNow: () => number = Date.now): CursorStore =>
  new MemoryCursorStore(stampedNow);
