import { carriedDeliveryId } from "./delivery-id.ts";
import { asRecord } from "./unknown-record.ts";
import { isAuthorWorkReviewState, isReviewState, type Mode } from "./vocabulary.ts";

import type { FilteredEvent } from "./filtered-event.ts";

const submittedReviewShape = (
  event: Readonly<Record<string, unknown>>,
): { readonly pullNumber: number; readonly state: string; readonly body: string | null } | null => {
  const pullNumber = asRecord(event.pull_request)?.number;
  const review = asRecord(event.review);
  const state = review?.state;
  const body = review?.body;
  if (typeof pullNumber !== "number" || typeof state !== "string") return null;
  if (typeof body !== "string" && body !== null) return null;
  return { pullNumber, state, body };
};

export const filterReviewEvent = (
  event: Readonly<Record<string, unknown>>,
  mode: Mode,
): FilteredEvent | null => {
  if (mode === "reviewer") return null;
  const review = submittedReviewShape(event);
  if (review === null || event.action !== "submitted") return null;
  const normalizedState = review.state.toLowerCase();
  if (!isReviewState(normalizedState) || !isAuthorWorkReviewState(normalizedState)) return null;
  return {
    kind: "source-review-submitted",
    pullNumber: review.pullNumber,
    state: normalizedState,
    body: review.body ?? "",
    ...carriedDeliveryId(event),
  };
};
