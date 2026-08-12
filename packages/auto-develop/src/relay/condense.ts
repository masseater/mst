import { asRecord } from "../contract/unknown-record.ts";

const namedEntries = (
  candidates: unknown,
  field: string,
): readonly Readonly<Record<string, string>>[] => {
  if (!Array.isArray(candidates)) return [];
  return candidates.flatMap((candidate) => {
    const fieldEntry = asRecord(candidate)?.[field];
    return typeof fieldEntry === "string" ? [{ [field]: fieldEntry }] : [];
  });
};

const condensedPullRequest = (
  pullRequest: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const login = asRecord(pullRequest.user)?.login;
  const spelledLabels = namedEntries(pullRequest.labels, "name");
  const requestedReviewers = namedEntries(pullRequest.requested_reviewers, "login");
  return {
    ...(typeof pullRequest.number === "number" ? { number: pullRequest.number } : {}),
    ...(typeof login === "string" ? { user: { login } } : {}),
    ...(pullRequest.mergeable === undefined ? {} : { mergeable: pullRequest.mergeable }),
    ...(pullRequest.merge_state_status === undefined
      ? {}
      : { merge_state_status: pullRequest.merge_state_status }),
    ...(spelledLabels.length === 0 ? {} : { labels: spelledLabels }),
    ...(requestedReviewers.length === 0 ? {} : { requested_reviewers: requestedReviewers }),
  };
};

const condensePullRequestEvent = (
  carried: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const pullRequest = asRecord(carried.pull_request);
  const requestedReviewerLogin = asRecord(carried.requested_reviewer)?.login;
  const changes = asRecord(carried.changes);
  const labelName = asRecord(carried.label)?.name;
  return {
    action: carried.action,
    ...(pullRequest === undefined ? {} : { pull_request: condensedPullRequest(pullRequest) }),
    ...(typeof requestedReviewerLogin === "string"
      ? { requested_reviewer: { login: requestedReviewerLogin } }
      : {}),
    ...(changes !== undefined && Object.hasOwn(changes, "base") ? { changes: { base: {} } } : {}),
    ...(typeof labelName === "string" ? { label: { name: labelName } } : {}),
  };
};

const condenseReviewEvent = (
  carried: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const pullRequest = asRecord(carried.pull_request);
  const login = asRecord(pullRequest?.user)?.login;
  const review = asRecord(carried.review);
  return {
    action: carried.action,
    ...(pullRequest === undefined
      ? {}
      : {
          pull_request: {
            ...(typeof pullRequest.number === "number" ? { number: pullRequest.number } : {}),
            ...(typeof login === "string" ? { user: { login } } : {}),
          },
        }),
    ...(review === undefined ? {} : { review: { body: review.body, state: review.state } }),
  };
};

const condenseCheckSuiteEvent = (
  carried: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> => {
  const checkSuite = asRecord(carried.check_suite);
  if (checkSuite === undefined) return { action: carried.action };
  const pullRequests = Array.isArray(checkSuite.pull_requests)
    ? checkSuite.pull_requests.flatMap((candidate) => {
        const mentionedNumber = asRecord(candidate)?.number;
        return typeof mentionedNumber === "number" ? [{ number: mentionedNumber }] : [];
      })
    : [];
  return {
    action: carried.action,
    check_suite: {
      conclusion: checkSuite.conclusion,
      head_sha: checkSuite.head_sha,
      pull_requests: pullRequests,
    },
  };
};

export const condenseWebhookPayload = (webhook: {
  readonly eventType: string;
  readonly payload: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> => {
  if (webhook.eventType === "pull_request") return condensePullRequestEvent(webhook.payload);
  if (webhook.eventType === "pull_request_review") return condenseReviewEvent(webhook.payload);
  if (webhook.eventType === "check_suite") return condenseCheckSuiteEvent(webhook.payload);
  return { action: webhook.payload.action };
};
