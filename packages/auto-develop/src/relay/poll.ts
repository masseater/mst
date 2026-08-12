import { sealEnvelope, type EventEnvelope } from "../contract/envelope.ts";
import { REPLAY_WINDOW_MS } from "./durations.ts";

import type { OwnerFilter } from "./owner-filter.ts";
import type { CursorStore, EventStore, StoredEvent } from "./store.ts";

export const readResumableEvents = async (resumption: {
  readonly events: EventStore;
  readonly resumeAfterId: string | null;
  readonly nowMs: number;
}): Promise<readonly StoredEvent[]> => {
  if (resumption.resumeAfterId !== null && resumption.resumeAfterId !== "") {
    const following = await resumption.events.readAfterId(resumption.resumeAfterId);
    if (following !== null) return following;
  }
  return resumption.events.readSince(resumption.nowMs - REPLAY_WINDOW_MS);
};

const ownedEventsOf = async (selection: {
  readonly scanned: readonly StoredEvent[];
  readonly ownerFilter: OwnerFilter;
  readonly subscriberLogin: string;
}): Promise<readonly StoredEvent[]> => {
  for (const stored of selection.scanned) selection.ownerFilter.remember(stored);
  const ownershipFlags = await Promise.all(
    selection.scanned.map((stored) =>
      selection.ownerFilter.owns({ event: stored, subscriberLogin: selection.subscriberLogin }),
    ),
  );
  return selection.scanned.filter((_stored, index) => ownershipFlags[index] === true);
};

export const toEnvelope = (stored: StoredEvent): EventEnvelope =>
  sealEnvelope({
    eventType: stored.eventType,
    deliveryId: stored.deliveryId,
    payload: stored.payload,
  });

export const runPoll = async (poll: {
  readonly clientId: string;
  readonly subscriberLogin: string;
  readonly events: EventStore;
  readonly cursors: CursorStore;
  readonly ownerFilter: OwnerFilter;
  readonly now?: () => number;
}): Promise<readonly EventEnvelope[]> => {
  const now = poll.now ?? Date.now;
  const savedCursor = await poll.cursors.read(poll.clientId);
  const scanned = await readResumableEvents({
    events: poll.events,
    resumeAfterId: savedCursor,
    nowMs: now(),
  });
  const owned = await ownedEventsOf({
    scanned,
    ownerFilter: poll.ownerFilter,
    subscriberLogin: poll.subscriberLogin,
  });
  const scannedTail = scanned.at(-1);
  if (scannedTail !== undefined) {
    await poll.cursors.write({ clientId: poll.clientId, eventId: scannedTail.id });
  }
  return owned.map(toEnvelope);
};
