export const MODES = ["author", "reviewer"] as const;

export type Mode = (typeof MODES)[number];

export const isMode = (candidate: unknown): candidate is Mode =>
  (MODES as readonly unknown[]).includes(candidate);

export const REVIEW_STATES = ["changes_requested", "commented", "approved"] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export const isReviewState = (candidate: string): candidate is ReviewState =>
  (REVIEW_STATES as readonly string[]).includes(candidate);

export const AUTHOR_WORK_REVIEW_STATES = ["changes_requested"] as const;

export type AuthorWorkReviewState = (typeof AUTHOR_WORK_REVIEW_STATES)[number];

export const isAuthorWorkReviewState = (
  candidate: ReviewState,
): candidate is AuthorWorkReviewState =>
  (AUTHOR_WORK_REVIEW_STATES as readonly ReviewState[]).includes(candidate);

export const CHECK_SUITE_CONCLUSIONS = [
  "success",
  "failure",
  "neutral",
  "cancelled",
  "skipped",
  "timed_out",
  "action_required",
  "startup_failure",
  "stale",
] as const;

export type CheckSuiteConclusion = (typeof CHECK_SUITE_CONCLUSIONS)[number];

export const isCheckSuiteConclusion = (candidate: unknown): candidate is CheckSuiteConclusion =>
  (CHECK_SUITE_CONCLUSIONS as readonly unknown[]).includes(candidate);

export const AUTHOR_WORK_CONCLUSIONS = ["failure", "timed_out", "startup_failure"] as const;

export type AuthorWorkConclusion = (typeof AUTHOR_WORK_CONCLUSIONS)[number];

export const isAuthorWorkConclusion = (
  candidate: CheckSuiteConclusion,
): candidate is AuthorWorkConclusion =>
  (AUTHOR_WORK_CONCLUSIONS as readonly CheckSuiteConclusion[]).includes(candidate);

export const EXCLUSION_LABEL = "exclude-auto-develop";

export const indicatesMergeConflict = (pullRequest: Readonly<Record<string, unknown>>): boolean =>
  pullRequest.mergeable === "CONFLICTING" || pullRequest.merge_state_status === "DIRTY";

export const indicatesBehindBase = (pullRequest: Readonly<Record<string, unknown>>): boolean =>
  pullRequest.merge_state_status === "BEHIND";
