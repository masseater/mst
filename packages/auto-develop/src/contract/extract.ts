import { asRecord } from "./unknown-record.ts";

export const pullRequestAuthorLogin = (
  payload: Readonly<Record<string, unknown>>,
): string | undefined => {
  const login = asRecord(asRecord(payload.pull_request)?.user)?.login;
  return typeof login === "string" ? login : undefined;
};

export const requestedReviewerLogin = (
  payload: Readonly<Record<string, unknown>>,
): string | undefined => {
  const login = asRecord(payload.requested_reviewer)?.login;
  return typeof login === "string" ? login : undefined;
};

export const requestedReviewerLogins = (
  payload: Readonly<Record<string, unknown>>,
): readonly string[] => {
  const reviewers = asRecord(payload.pull_request)?.requested_reviewers;
  if (!Array.isArray(reviewers)) return [];
  return reviewers.flatMap((reviewer) => {
    const login = asRecord(reviewer)?.login;
    return typeof login === "string" ? [login] : [];
  });
};

export const mentionedPullNumbers = (
  payload: Readonly<Record<string, unknown>>,
): readonly number[] => {
  const pullNumber = asRecord(payload.pull_request)?.number;
  if (typeof pullNumber === "number") return [pullNumber];
  const pullRequests = asRecord(payload.check_suite)?.pull_requests;
  if (!Array.isArray(pullRequests)) return [];
  return pullRequests.flatMap((pullRequest) => {
    const mentionedNumber = asRecord(pullRequest)?.number;
    return typeof mentionedNumber === "number" ? [mentionedNumber] : [];
  });
};
