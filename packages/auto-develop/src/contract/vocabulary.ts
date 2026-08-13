/** @canonical-values auto-develop.declared-mode */
const DECLARED_MODES = ["author", "reviewer"] as const;

export const DECLARED_MODE = {
  author: DECLARED_MODES[0],
  reviewer: DECLARED_MODES[1],
} as const;

export type Mode = (typeof DECLARED_MODES)[number];

export const isMode = (candidate: unknown): candidate is Mode =>
  (DECLARED_MODES as readonly unknown[]).includes(candidate);

/** @canonical-values auto-develop.review-state */
const REVIEW_STATES = ["changes_requested", "commented", "approved"] as const;

export const REVIEW_STATE = {
  changesRequested: REVIEW_STATES[0],
  commented: REVIEW_STATES[1],
  approved: REVIEW_STATES[2],
} as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export const isReviewState = (candidate: string): candidate is ReviewState =>
  (REVIEW_STATES as readonly string[]).includes(candidate);

const AUTHOR_WORK_REVIEW_STATES = [REVIEW_STATE.changesRequested] as const;

export type AuthorWorkReviewState = (typeof AUTHOR_WORK_REVIEW_STATES)[number];

export const isAuthorWorkReviewState = (
  candidate: ReviewState,
): candidate is AuthorWorkReviewState =>
  (AUTHOR_WORK_REVIEW_STATES as readonly ReviewState[]).includes(candidate);

/** @canonical-values auto-develop.check-suite-conclusion */
const CHECK_SUITE_CONCLUSIONS = [
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

export const CHECK_SUITE_CONCLUSION = {
  success: CHECK_SUITE_CONCLUSIONS[0],
  failure: CHECK_SUITE_CONCLUSIONS[1],
  neutral: CHECK_SUITE_CONCLUSIONS[2],
  cancelled: CHECK_SUITE_CONCLUSIONS[3],
  skipped: CHECK_SUITE_CONCLUSIONS[4],
  timedOut: CHECK_SUITE_CONCLUSIONS[5],
  actionRequired: CHECK_SUITE_CONCLUSIONS[6],
  startupFailure: CHECK_SUITE_CONCLUSIONS[7],
  stale: CHECK_SUITE_CONCLUSIONS[8],
} as const;

export type CheckSuiteConclusion = (typeof CHECK_SUITE_CONCLUSIONS)[number];

export const isCheckSuiteConclusion = (candidate: unknown): candidate is CheckSuiteConclusion =>
  (CHECK_SUITE_CONCLUSIONS as readonly unknown[]).includes(candidate);

const AUTHOR_WORK_CONCLUSIONS = [
  CHECK_SUITE_CONCLUSION.failure,
  CHECK_SUITE_CONCLUSION.timedOut,
  CHECK_SUITE_CONCLUSION.startupFailure,
] as const;

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
