import { sealEnvelope, type EventEnvelope } from "../contract/envelope.ts";
import { asRecord } from "../contract/unknown-record.ts";
import { toWebhookShape } from "../contract/webhook-shape.ts";

import type { FilteredEvent } from "../contract/filtered-event.ts";
import type { GithubPullSummary } from "./github-reader.ts";

const withAuthor = (
  carried: Readonly<Record<string, unknown>>,
  authorLogin: string | null,
): Readonly<Record<string, unknown>> => {
  if (authorLogin === null) return carried;
  const pullRequest = asRecord(carried.pull_request) ?? {};
  return { ...carried, pull_request: { ...pullRequest, user: { login: authorLogin } } };
};

export const synthesizeEnvelope = (synthesis: {
  readonly filtered: FilteredEvent;
  readonly deliveryId: string;
  readonly authorLogin: string | null;
}): EventEnvelope => {
  const shape = toWebhookShape(synthesis.filtered);
  return sealEnvelope({
    eventType: shape.eventType,
    deliveryId: synthesis.deliveryId,
    payload: withAuthor(shape.payload, synthesis.authorLogin),
  });
};

export const startupDrainDeliveryId = (drained: {
  readonly eventType: string;
  readonly detail: string;
}): string => `startup-drain:${drained.eventType}:${drained.detail}`;

export const baseUpdateCheckDeliveryId = (pull: GithubPullSummary): string =>
  `check-base-updates:${pull.number}:${pull.baseSha}:${pull.headSha}`;
