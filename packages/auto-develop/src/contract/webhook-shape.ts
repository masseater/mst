import { EXCLUSION_LABEL } from "./vocabulary.ts";

import type { FilteredEvent } from "./filtered-event.ts";

export type WebhookShapedEvent = {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

const reviewRequestedShape = (
  event: Extract<FilteredEvent, { kind: "review-requested" }>,
): WebhookShapedEvent => ({
  eventType: "pull_request",
  payload: {
    action: "review_requested",
    pull_request: {
      number: event.pullNumber,
      ...(event.title === undefined ? {} : { title: event.title }),
      ...(event.draft === undefined ? {} : { draft: event.draft }),
    },
    ...(event.reviewerLogin === undefined
      ? {}
      : { requested_reviewer: { login: event.reviewerLogin } }),
  },
});

const reviewInputChangedShape = (
  event: Extract<FilteredEvent, { kind: "review-input-changed" }>,
): WebhookShapedEvent =>
  event.changedInput === "head"
    ? {
        eventType: "pull_request",
        payload: { action: "synchronize", pull_request: { number: event.pullNumber } },
      }
    : {
        eventType: "pull_request",
        payload: {
          action: "edited",
          changes: { base: {} },
          pull_request: { number: event.pullNumber },
        },
      };

export const toWebhookShape = (event: FilteredEvent): WebhookShapedEvent => {
  switch (event.kind) {
    case "review-requested":
      return reviewRequestedShape(event);
    case "review-input-changed":
      return reviewInputChangedShape(event);
    case "source-review-submitted":
      return {
        eventType: "pull_request_review",
        payload: {
          action: "submitted",
          pull_request: { number: event.pullNumber },
          review: { state: event.state, body: event.body },
        },
      };
    case "ci-completed":
      return {
        eventType: "check_suite",
        payload: {
          action: "completed",
          check_suite: {
            conclusion: event.conclusion,
            head_sha: event.headSha,
            pull_requests: [{ number: event.pullNumber }],
          },
        },
      };
    case "merge-conflict":
      return {
        eventType: "pull_request",
        payload: {
          action: "synchronize",
          pull_request: {
            number: event.pullNumber,
            mergeable: "CONFLICTING",
            merge_state_status: "DIRTY",
          },
        },
      };
    case "base-update":
      return {
        eventType: "pull_request",
        payload: {
          action: "synchronize",
          pull_request: {
            number: event.pullNumber,
            mergeable: "MERGEABLE",
            merge_state_status: "BEHIND",
          },
        },
      };
    case "pr-closed":
      return {
        eventType: "pull_request",
        payload: { action: "closed", pull_request: { number: event.pullNumber } },
      };
    case "pr-excluded":
      return {
        eventType: "pull_request",
        payload: {
          action: "labeled",
          pull_request: { number: event.pullNumber },
          label: { name: EXCLUSION_LABEL },
        },
      };
  }
};
