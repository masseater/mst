import { attempt } from "es-toolkit";

import { asRecord } from "../contract/unknown-record.ts";
import { EXCLUSION_LABEL } from "../contract/vocabulary.ts";
import { condenseWebhookPayload } from "./condense.ts";
import { EVENT_TTL_MS } from "./durations.ts";
import { verifyWebhookSignature } from "./signature.ts";

import type { Logger } from "../logging/logger.ts";
import type { EventStore } from "./store.ts";

export type WebhookOutcome = {
  readonly status: number;
  readonly body: Readonly<Record<string, unknown>>;
};

export type WebhookRequest = {
  readonly rawBody: string;
  readonly eventType: string | undefined;
  readonly deliveryId: string | undefined;
  readonly signatureHeader: string | undefined;
  readonly config: { readonly webhookSecret: string; readonly githubRepository: string };
  readonly events: EventStore;
  readonly log: Logger;
  readonly now?: () => number;
};

const hasExclusionLabel = (payload: Readonly<Record<string, unknown>>): boolean => {
  const labels = asRecord(payload.pull_request)?.labels;
  if (!Array.isArray(labels)) return false;
  return labels.some((label) => asRecord(label)?.name === EXCLUSION_LABEL);
};

const isExclusionLabelEdge = (payload: Readonly<Record<string, unknown>>): boolean => {
  const isEdgeAction = payload.action === "labeled" || payload.action === "unlabeled";
  return isEdgeAction && asRecord(payload.label)?.name === EXCLUSION_LABEL;
};

const skippedByExclusion = (webhook: {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
}): boolean => {
  if (webhook.eventType !== "pull_request" && webhook.eventType !== "pull_request_review") {
    return false;
  }
  if (!hasExclusionLabel(webhook.payload)) return false;
  if (webhook.payload.action === "closed") return false;
  return !isExclusionLabelEdge(webhook.payload);
};

const parseJsonBody = (rawBody: string): Readonly<Record<string, unknown>> | undefined => {
  const [parseFailure, parsed] = attempt((): unknown => JSON.parse(rawBody));
  return parseFailure === null ? asRecord(parsed) : undefined;
};

const requiredHeaders = (
  request: WebhookRequest,
): { readonly eventType: string; readonly deliveryId: string } | null =>
  request.eventType !== undefined && request.deliveryId !== undefined
    ? { eventType: request.eventType, deliveryId: request.deliveryId }
    : null;

const skippedResponse = (webhook: {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly githubRepository: string;
}): WebhookOutcome | null => {
  if (asRecord(webhook.payload.repository)?.full_name !== webhook.githubRepository) {
    return { status: 200, body: { skipped: true, reason: "repository not allowed" } };
  }
  if (skippedByExclusion(webhook)) {
    return { status: 200, body: { skipped: true, reason: "excluded by label" } };
  }
  return null;
};

const deleteClosedPullEvents = async (deletion: {
  readonly events: EventStore;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly deliveryId: string;
  readonly log: Logger;
}): Promise<void> => {
  const prNumber = asRecord(deletion.payload.pull_request)?.number;
  if (deletion.payload.action !== "closed" || typeof prNumber !== "number") return;
  try {
    const deletedCount = await deletion.events.deleteForPr({
      prNumber,
      excludeDeliveryId: deletion.deliveryId,
    });
    deletion.log.info({ prNumber, deletedCount }, "deleted stored events for closed PR");
  } catch (failure) {
    deletion.log.warn({ prNumber, err: failure }, "failed to delete stored events for closed PR");
  }
};

const storeCondensedEvent = async (storing: {
  readonly request: WebhookRequest;
  readonly eventType: string;
  readonly deliveryId: string;
  readonly payload: Readonly<Record<string, unknown>>;
}): Promise<WebhookOutcome> => {
  const now = storing.request.now ?? Date.now;
  const receivedAtMs = now();
  const condensed = condenseWebhookPayload({
    eventType: storing.eventType,
    payload: storing.payload,
  });
  await storing.request.events.createIfAbsent({
    id: storing.deliveryId,
    eventType: storing.eventType,
    deliveryId: storing.deliveryId,
    payload: condensed,
    receivedAtMs,
    expiresAtMs: receivedAtMs + EVENT_TTL_MS,
  });
  storing.request.log.info(
    {
      eventType: storing.eventType,
      deliveryId: storing.deliveryId,
      repository: storing.request.config.githubRepository,
      action: condensed.action,
      prNumber: asRecord(condensed.pull_request)?.number,
    },
    "webhook accepted",
  );
  if (storing.eventType === "pull_request") {
    await deleteClosedPullEvents({
      events: storing.request.events,
      payload: condensed,
      deliveryId: storing.deliveryId,
      log: storing.request.log,
    });
  }
  return { status: 200, body: { accepted: true } };
};

export const handleWebhook = async (request: WebhookRequest): Promise<WebhookOutcome> => {
  const headers = requiredHeaders(request);
  if (headers === null) return { status: 400, body: { error: "Missing required headers" } };
  const signatureAccepted = verifyWebhookSignature({
    body: request.rawBody,
    signatureHeader: request.signatureHeader,
    secret: request.config.webhookSecret,
  });
  if (!signatureAccepted) return { status: 401, body: { error: "Invalid signature" } };
  if (headers.eventType === "ping") return { status: 200, body: { pong: true } };
  const payload = parseJsonBody(request.rawBody);
  if (payload === undefined) return { status: 400, body: { error: "Invalid JSON body" } };
  const skip = skippedResponse({
    eventType: headers.eventType,
    payload,
    githubRepository: request.config.githubRepository,
  });
  if (skip !== null) return skip;
  return storeCondensedEvent({ request, ...headers, payload });
};
