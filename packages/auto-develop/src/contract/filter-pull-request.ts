import { carriedDeliveryId } from "./delivery-id.ts";
import { requestedReviewerLogin } from "./extract.ts";
import { asRecord } from "./unknown-record.ts";
import {
  DECLARED_MODE,
  EXCLUSION_LABEL,
  indicatesBehindBase,
  indicatesMergeConflict,
  type Mode,
} from "./vocabulary.ts";

import type { FilteredEvent } from "./filtered-event.ts";

type PullRequestShape = {
  readonly delivered: Readonly<Record<string, unknown>>;
  readonly action: string;
  readonly pullRequest: Readonly<Record<string, unknown>>;
  readonly pullNumber: number;
};

const pullRequestShape = (
  delivered: Readonly<Record<string, unknown>>,
): PullRequestShape | null => {
  const action = delivered.action;
  const pullRequest = asRecord(delivered.pull_request);
  const pullNumber = pullRequest?.number;
  if (typeof action !== "string" || pullRequest === undefined || typeof pullNumber !== "number") {
    return null;
  }
  return { delivered, action, pullRequest, pullNumber };
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
    ...carriedDeliveryId(shape.delivered),
  };
};

const exclusionEdgeEvent = (shape: PullRequestShape, spelledMode: Mode): FilteredEvent | null => {
  if (shape.action === "labeled") {
    return {
      kind: "pr-excluded",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.delivered),
    };
  }
  return spelledMode === DECLARED_MODE.reviewer ? reviewRequestedEvent(shape, undefined) : null;
};

const filterForReviewer = (shape: PullRequestShape): FilteredEvent | null => {
  if (shape.action === "synchronize") {
    return {
      kind: "review-input-changed",
      changedInput: "head",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.delivered),
    };
  }
  const changes = asRecord(shape.delivered.changes);
  if (shape.action === "edited" && changes !== undefined && Object.hasOwn(changes, "base")) {
    return {
      kind: "review-input-changed",
      changedInput: "base",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.delivered),
    };
  }
  if (shape.action === "review_requested") {
    return reviewRequestedEvent(shape, requestedReviewerLogin(shape.delivered));
  }
  return null;
};

const filterForAuthor = (shape: PullRequestShape): FilteredEvent | null => {
  if (indicatesMergeConflict(shape.pullRequest)) {
    return {
      kind: "merge-conflict",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.delivered),
    };
  }
  if (indicatesBehindBase(shape.pullRequest)) {
    return {
      kind: "base-update",
      pullNumber: shape.pullNumber,
      ...carriedDeliveryId(shape.delivered),
    };
  }
  return null;
};

export const filterPullRequestEvent = (
  delivered: Readonly<Record<string, unknown>>,
  spelledMode: Mode,
): FilteredEvent | null => {
  const shape = pullRequestShape(delivered);
  if (shape === null) return null;
  if (shape.action === "closed") {
    return { kind: "pr-closed", pullNumber: shape.pullNumber, ...carriedDeliveryId(delivered) };
  }
  const isExclusionEdge = shape.action === "labeled" || shape.action === "unlabeled";
  if (isExclusionEdge && asRecord(delivered.label)?.name === EXCLUSION_LABEL) {
    return exclusionEdgeEvent(shape, spelledMode);
  }
  return spelledMode === DECLARED_MODE.reviewer ? filterForReviewer(shape) : filterForAuthor(shape);
};
