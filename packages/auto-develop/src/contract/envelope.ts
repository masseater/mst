import { asRecord } from "./unknown-record.ts";

const ENVELOPE_SCHEMA_VERSION = 1;

export type EventEnvelope = {
  readonly schema_version: typeof ENVELOPE_SCHEMA_VERSION;
  readonly event_type: string;
  readonly delivery_id: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

class InvalidEnvelopeError extends Error {
  override readonly name = "InvalidEnvelopeError";

  constructor() {
    super("イベント封筒が契約の形と一致しない");
  }
}

export const sealEnvelope = (envelope: {
  readonly eventType: string;
  readonly deliveryId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}): EventEnvelope => ({
  schema_version: ENVELOPE_SCHEMA_VERSION,
  event_type: envelope.eventType,
  delivery_id: envelope.deliveryId,
  payload: envelope.payload,
});

export const unwrapEnvelope = (candidate: unknown): Readonly<Record<string, unknown>> => {
  const envelope = asRecord(candidate);
  const eventType = envelope?.event_type;
  const deliveryId = envelope?.delivery_id;
  const carried = asRecord(envelope?.payload);
  if (
    envelope?.schema_version !== ENVELOPE_SCHEMA_VERSION ||
    typeof eventType !== "string" ||
    typeof deliveryId !== "string" ||
    carried === undefined
  ) {
    throw new InvalidEnvelopeError();
  }
  return { ...carried, event_type: eventType, delivery_id: deliveryId };
};

export const unwrapPollResponse = (
  candidate: unknown,
): readonly Readonly<Record<string, unknown>>[] => {
  const envelopes = asRecord(candidate)?.events;
  if (!Array.isArray(envelopes)) throw new InvalidEnvelopeError();
  return envelopes.map(unwrapEnvelope);
};
