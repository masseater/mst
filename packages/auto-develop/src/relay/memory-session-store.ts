import type { SessionStore, StoredSession } from "./store.ts";

class MemorySessionStore implements SessionStore {
  #sessions: ReadonlyMap<string, StoredSession> = new Map();

  readonly save = ({
    digest,
    login,
    expiresAtMs,
  }: { readonly digest: string } & StoredSession): Promise<void> => {
    this.#sessions = new Map<string, StoredSession>([
      ...this.#sessions,
      [digest, { login, expiresAtMs }],
    ]);
    return Promise.resolve();
  };

  readonly resolve = (digest: string): Promise<StoredSession | null> =>
    Promise.resolve(this.#sessions.get(digest) ?? null);
}

export const createMemorySessionStore = (): SessionStore => new MemorySessionStore();
