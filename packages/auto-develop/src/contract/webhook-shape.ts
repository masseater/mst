import { EXCLUSION_LABEL } from "./vocabulary.ts";

import type { FilteredEvent } from "./filtered-event.ts";

export type WebhookShapedEvent = {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

const reviewRequestedShape = (
  webhookEvent: Extract<FilteredEvent, { kind: "review-requested" }>,
): WebhookShapedEvent => ({
  eventType: "pull_request",
  payload: {
    action: "review_requested",
    pull_request: {
      number: webhookEvent.pullNumber,
      ...(webhookEvent.title === undefined ? {} : { title: webhookEvent.title }),
      ...(webhookEvent.draft === undefined ? {} : { draft: webhookEvent.draft }),
    },
    ...(webhookEvent.reviewerLogin === undefined
      ? {}
      : { requested_reviewer: { login: webhookEvent.reviewerLogin } }),
  },
});

const reviewInputChangedShape = (
  webhookEvent: Extract<FilteredEvent, { kind: "review-input-changed" }>,
): WebhookShapedEvent =>
  webhookEvent.changedInput === "head"
    ? {
        eventType: "pull_request",
        payload: { action: "synchronize", pull_request: { number: webhookEvent.pullNumber } },
      }
    : {
        eventType: "pull_request",
        payload: {
          action: "edited",
          changes: { base: {} },
          pull_request: { number: webhookEvent.pullNumber },
        },
      };

export const toWebhookShape = (webhookEvent: FilteredEvent): WebhookShapedEvent => {
  switch (webhookEvent.kind) {
    case "review-requested":
      return reviewRequestedShape(webhookEvent);
    case "review-input-changed":
      return reviewInputChangedShape(webhookEvent);
    case "source-review-submitted":
      return {
        eventType: "pull_request_review",
        payload: {
          action: "submitted",
          pull_request: { number: webhookEvent.pullNumber },
          review: { state: webhookEvent.state, body: webhookEvent.body },
        },
      };
    case "ci-completed":
      return {
        eventType: "check_suite",
        payload: {
          action: "completed",
          check_suite: {
            conclusion: webhookEvent.conclusion,
            head_sha: webhookEvent.headSha,
            pull_requests: [{ number: webhookEvent.pullNumber }],
          },
        },
      };
    case "merge-conflict":
      return {
        eventType: "pull_request",
        payload: {
          action: "synchronize",
          pull_request: {
            number: webhookEvent.pullNumber,
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
            number: webhookEvent.pullNumber,
            mergeable: "MERGEABLE",
            merge_state_status: "BEHIND",
          },
        },
      };
    case "pr-closed":
      return {
        eventType: "pull_request",
        payload: { action: "closed", pull_request: { number: webhookEvent.pullNumber } },
      };
    case "pr-excluded":
      return {
        eventType: "pull_request",
        payload: {
          action: "labeled",
          pull_request: { number: webhookEvent.pullNumber },
          label: { name: EXCLUSION_LABEL },
        },
      };
  }
};
