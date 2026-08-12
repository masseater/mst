import { asRecord } from "./unknown-record.ts";

export const pullRequestAuthorLogin = (
  carried: Readonly<Record<string, unknown>>,
): string | undefined => {
  const login = asRecord(asRecord(carried.pull_request)?.user)?.login;
  return typeof login === "string" ? login : undefined;
};

export const requestedReviewerLogin = (
  carried: Readonly<Record<string, unknown>>,
): string | undefined => {
  const login = asRecord(carried.requested_reviewer)?.login;
  return typeof login === "string" ? login : undefined;
};

export const requestedReviewerLogins = (
  carried: Readonly<Record<string, unknown>>,
): readonly string[] => {
  const reviewers = asRecord(carried.pull_request)?.requested_reviewers;
  if (!Array.isArray(reviewers)) return [];
  return reviewers.flatMap((reviewer) => {
    const login = asRecord(reviewer)?.login;
    return typeof login === "string" ? [login] : [];
  });
};

export const mentionedPullNumbers = (
  carried: Readonly<Record<string, unknown>>,
): readonly number[] => {
  const pullNumber = asRecord(carried.pull_request)?.number;
  if (typeof pullNumber === "number") return [pullNumber];
  const pullRequests = asRecord(carried.check_suite)?.pull_requests;
  if (!Array.isArray(pullRequests)) return [];
  return pullRequests.flatMap((pullRequest) => {
    const mentionedNumber = asRecord(pullRequest)?.number;
    return typeof mentionedNumber === "number" ? [mentionedNumber] : [];
  });
};
