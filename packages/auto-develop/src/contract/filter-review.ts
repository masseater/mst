import { carriedDeliveryId } from "./delivery-id.ts";
import { asRecord } from "./unknown-record.ts";
import { isAuthorWorkReviewState, isReviewState, type Mode } from "./vocabulary.ts";

import type { FilteredEvent } from "./filtered-event.ts";

const submittedReviewShape = (
  delivered: Readonly<Record<string, unknown>>,
): { readonly pullNumber: number; readonly state: string; readonly body: string | null } | null => {
  const pullNumber = asRecord(delivered.pull_request)?.number;
  const review = asRecord(delivered.review);
  const heldState = review?.state;
  const writtenBody = review?.body;
  if (typeof pullNumber !== "number" || typeof heldState !== "string") return null;
  if (typeof writtenBody !== "string" && writtenBody !== null) return null;
  return { pullNumber, state: heldState, body: writtenBody };
};

export const filterReviewEvent = (
  delivered: Readonly<Record<string, unknown>>,
  spelledMode: Mode,
): FilteredEvent | null => {
  if (spelledMode === "reviewer") return null;
  const review = submittedReviewShape(delivered);
  if (review === null || delivered.action !== "submitted") return null;
  const normalizedState = review.state.toLowerCase();
  if (!isReviewState(normalizedState) || !isAuthorWorkReviewState(normalizedState)) return null;
  return {
    kind: "source-review-submitted",
    pullNumber: review.pullNumber,
    state: normalizedState,
    body: review.body ?? "",
    ...carriedDeliveryId(delivered),
  };
};
