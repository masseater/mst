/** @canonical-values auto-develop.github-review-state */
const GITHUB_REVIEW_STATES = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
  "PENDING",
] as const;

export const GITHUB_REVIEW_STATE = {
  approved: GITHUB_REVIEW_STATES[0],
  changesRequested: GITHUB_REVIEW_STATES[1],
  commented: GITHUB_REVIEW_STATES[2],
  dismissed: GITHUB_REVIEW_STATES[3],
  pending: GITHUB_REVIEW_STATES[4],
} as const;

type GithubReviewState = (typeof GITHUB_REVIEW_STATES)[number];

export type Review = {
  readonly state: GithubReviewState;
  readonly body: string;
  readonly submittedAt: string;
  readonly commitSha: string;
  readonly authorLogin: string;
};

const EFFECTIVE_STATES: readonly GithubReviewState[] = [
  GITHUB_REVIEW_STATE.approved,
  GITHUB_REVIEW_STATE.changesRequested,
];

export const effectiveReviewOf = (derive: {
  readonly reviews: readonly Review[];
  readonly login: string;
}): Review | null => {
  const effective = derive.reviews.filter(
    (review) => review.authorLogin === derive.login && EFFECTIVE_STATES.includes(review.state),
  );
  return effective.at(-1) ?? null;
};

/** @canonical-values auto-develop.commit-status-state */
const COMMIT_STATUS_STATES = ["pending", "success", "failure", "error"] as const;

export const COMMIT_STATUS_STATE = {
  pending: COMMIT_STATUS_STATES[0],
  success: COMMIT_STATUS_STATES[1],
  failure: COMMIT_STATUS_STATES[2],
  error: COMMIT_STATUS_STATES[3],
} as const;

export type CommitStatusState = (typeof COMMIT_STATUS_STATES)[number];

export const reviewVerdictState = (effectiveReview: Review | null): CommitStatusState =>
  effectiveReview?.state === GITHUB_REVIEW_STATE.changesRequested
    ? COMMIT_STATUS_STATE.error
    : COMMIT_STATUS_STATE.success;
