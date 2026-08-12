export type StoredEvent = {
  readonly id: string;
  readonly eventType: string;
  readonly deliveryId: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly receivedAtMs: number;
  readonly expiresAtMs: number;
};

export type EventSubscription = {
  readonly unsubscribe: () => void;
};

export type EventStore = {
  readonly createIfAbsent: (event: StoredEvent) => Promise<StoredEvent>;
  readonly readAfterId: (eventId: string) => Promise<readonly StoredEvent[] | null>;
  readonly readSince: (sinceMs: number) => Promise<readonly StoredEvent[]>;
  readonly subscribeAfterId: (subscription: {
    readonly eventId: string;
    readonly onAdd: (event: StoredEvent) => void;
  }) => EventSubscription | null;
  readonly subscribeSince: (subscription: {
    readonly sinceMs: number;
    readonly onAdd: (event: StoredEvent) => void;
  }) => EventSubscription;
  readonly findAuthorEvent: (prNumber: number) => Promise<StoredEvent | null>;
  readonly deleteForPr: (deletion: {
    readonly prNumber: number;
    readonly excludeDeliveryId: string;
  }) => Promise<number>;
};

export type CursorStore = {
  readonly read: (clientId: string) => Promise<string | null>;
  readonly write: (cursor: {
    readonly clientId: string;
    readonly eventId: string;
  }) => Promise<void>;
};

export type StoredSession = {
  readonly login: string;
  readonly expiresAtMs: number;
};

export type SessionStore = {
  readonly save: (session: { readonly digest: string } & StoredSession) => Promise<void>;
  readonly resolve: (digest: string) => Promise<StoredSession | null>;
};

export class TransientStoreError extends Error {
  override readonly name = "TransientStoreError";
}
