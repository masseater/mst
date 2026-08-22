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
  readonly stampedNow?: () => number;
};

const hasExclusionLabel = (carried: Readonly<Record<string, unknown>>): boolean => {
  const spelledLabels = asRecord(carried.pull_request)?.labels;
  if (!Array.isArray(spelledLabels)) return false;
  return spelledLabels.some((spelledLabel) => asRecord(spelledLabel)?.name === EXCLUSION_LABEL);
};

const isExclusionLabelEdge = (carried: Readonly<Record<string, unknown>>): boolean => {
  const isEdgeAction = carried.action === "labeled" || carried.action === "unlabeled";
  return isEdgeAction && asRecord(carried.label)?.name === EXCLUSION_LABEL;
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

const parseJsonBody = (requestBody: string): Readonly<Record<string, unknown>> | undefined => {
  const [parseFailure, parsedNode] = attempt((): unknown => JSON.parse(requestBody));
  return parseFailure === null ? asRecord(parsedNode) : undefined;
};

const requiredHeaders = (
  asked: WebhookRequest,
): { readonly eventType: string; readonly deliveryId: string } | null =>
  asked.eventType !== undefined && asked.deliveryId !== undefined
    ? { eventType: asked.eventType, deliveryId: asked.deliveryId }
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
  const stampedNow = storing.request.stampedNow ?? Date.now;
  const receivedAtMs = stampedNow();
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

export const handleWebhook = async (asked: WebhookRequest): Promise<WebhookOutcome> => {
  const headers = requiredHeaders(asked);
  if (headers === null) return { status: 400, body: { error: "Missing required headers" } };
  const signatureAccepted = verifyWebhookSignature({
    body: asked.rawBody,
    signatureHeader: asked.signatureHeader,
    secret: asked.config.webhookSecret,
  });
  if (!signatureAccepted) return { status: 401, body: { error: "Invalid signature" } };
  if (headers.eventType === "ping") return { status: 200, body: { pong: true } };
  const carried = parseJsonBody(asked.rawBody);
  if (carried === undefined) return { status: 400, body: { error: "Invalid JSON body" } };
  const skip = skippedResponse({
    eventType: headers.eventType,
    payload: carried,
    githubRepository: asked.config.githubRepository,
  });
  if (skip !== null) return skip;
  return storeCondensedEvent({ request: asked, ...headers, payload: carried });
};
