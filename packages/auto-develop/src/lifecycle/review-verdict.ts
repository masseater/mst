const GITHUB_REVIEW_STATES = [
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
  "DISMISSED",
  "PENDING",
] as const;

type GithubReviewState = (typeof GITHUB_REVIEW_STATES)[number];

export type Review = {
  readonly state: GithubReviewState;
  readonly body: string;
  readonly submittedAt: string;
  readonly commitSha: string;
  readonly authorLogin: string;
};

const EFFECTIVE_STATES: readonly GithubReviewState[] = ["APPROVED", "CHANGES_REQUESTED"];

export const effectiveReviewOf = (derive: {
  readonly reviews: readonly Review[];
  readonly login: string;
}): Review | null => {
  const effective = derive.reviews.filter(
    (review) => review.authorLogin === derive.login && EFFECTIVE_STATES.includes(review.state),
  );
  return effective.at(-1) ?? null;
};

const COMMIT_STATUS_STATES = ["pending", "success", "failure", "error"] as const;

export type CommitStatusState = (typeof COMMIT_STATUS_STATES)[number];

export const reviewVerdictState = (effectiveReview: Review | null): CommitStatusState =>
  effectiveReview?.state === "CHANGES_REQUESTED" ? "error" : "success";
