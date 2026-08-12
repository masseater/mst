import type { CommitStatusState, Review } from "../lifecycle/review-verdict.ts";

export type PrSnapshot = {
  readonly prNumber: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly headRefName: string;
  readonly headRefOid: string;
  readonly baseRefName: string;
  readonly draft: boolean;
  readonly requestedReviewerLogins: readonly string[];
};

export type HandlerGithubClient = {
  readonly prSnapshot: (prNumber: number) => Promise<PrSnapshot>;
  readonly createCommitStatus: (request: {
    readonly sha: string;
    readonly state: CommitStatusState;
    readonly context: string;
    readonly description: string;
  }) => Promise<void>;
  readonly listReviews: (prNumber: number) => Promise<readonly Review[]>;
  readonly requestReviewers: (request: {
    readonly prNumber: number;
    readonly logins: readonly string[];
  }) => Promise<void>;
};

export const REVIEWER_STATUS_CONTEXT = "auto-develop/reviewer";

export const AUTHOR_STATUS_CONTEXT = "auto-develop/author";
