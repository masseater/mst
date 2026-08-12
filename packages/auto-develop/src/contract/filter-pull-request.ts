import { carriedDeliveryId } from "./delivery-id.ts";
import { requestedReviewerLogin } from "./extract.ts";
import { asRecord } from "./unknown-record.ts";
import {
  EXCLUSION_LABEL,
  indicatesBehindBase,
  indicatesMergeConflict,
  type Mode,
} from "./vocabulary.ts";

import type { FilteredEvent } from "./filtered-event.ts";

type PullRequestShape = {
  readonly event: Readonly<Record<string, unknown>>;
  readonly action: string;
  readonly pullRequest: Readonly<Record<string, unknown>>;
  readonly pullNumber: number;
};

const pullRequestShape = (event: Readonly<Record<string, unknown>>): PullRequestShape | null => {
  const action = event.action;
  const pullRequest = asRecord(event.pull_request);
  const pullNumber = pullRequest?.number;
  if (typeof action !== "string" || pullRequest === undefined || typeof pullNumber !== "number") {
    return null;
  }
  return { event, action, pullRequest, pullNumber };
};

const reviewRequestedEvent = (
  shape: PullRequestShape,
  reviewerLogin: string | undefined,
): FilteredEvent => {
  const title = shape.pullRequest.title;
  const draft = shape.pullRequest.draft;
  return {
    kind: "review-requested",
    pullNumber: shape.pullNumber,
    ...(reviewerLogin === undefined ? {} : { reviewerLogin }),
    ...(typeof title === "string" ? { title } : {}),
    ...(typeof draft === "boolean" ? { draft } : {}),
    ...carriedDeliveryId(shape.event),
  };
};

const exclusionEdgeEvent = (shape: PullRequestShape, mode: Mode): FilteredEvent | null => {
  if (shape.action === "labeled") {
    return { kind: "pr-excluded", pullNumber: shape.pullNumber, ...carriedDeliveryId(shape.event) };
  }
  return mode === "reviewer" ? reviewRequestedEvent(shape, undefined) : null;
};

const filterForReviewer = (shape: PullRequestShape): FilteredEvent | null => {
  if (shape.action === "synchronize") {
    return {
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.event),
    };
  }
  const changes = asRecord(shape.event.changes);
  if (shape.action === "edited" && changes !== undefined && Object.hasOwn(changes, "base")) {
    return {
      kind: "review-input-changed",
      changedInput: "base",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.event),
    };
  }
  if (shape.action === "review_requested") {
    return reviewRequestedEvent(shape, requestedReviewerLogin(shape.event));
  }
  return null;
};

const filterForAuthor = (shape: PullRequestShape): FilteredEvent | null => {
  if (indicatesMergeConflict(shape.pullRequest)) {
    return {
      kind: "merge-conflict",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.event),
    };
  }
  if (indicatesBehindBase(shape.pullRequest)) {
    return { kind: "base-update", pullNumber: shape.pullNumber, ...carriedDeliveryId(shape.event) };
  }
  return null;
};

export const filterPullRequestEvent = (
  event: Readonly<Record<string, unknown>>,
  mode: Mode,
): FilteredEvent | null => {
  const shape = pullRequestShape(event);
  if (shape === null) return null;
  if (shape.action === "closed") {
    return { kind: "pr-closed", pullNumber: shape.pullNumber, ...carriedDeliveryId(event) };
  }
  const isExclusionEdge = shape.action === "labeled" || shape.action === "unlabeled";
  if (isExclusionEdge && asRecord(event.label)?.name === EXCLUSION_LABEL) {
    return exclusionEdgeEvent(shape, mode);
  }
  return mode === "reviewer" ? filterForReviewer(shape) : filterForAuthor(shape);
};
