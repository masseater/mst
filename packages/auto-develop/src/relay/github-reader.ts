export type GithubPullSummary = {
  readonly number: number;
  readonly title: string;
  readonly draft: boolean;
  readonly authorLogin: string | null;
  readonly baseSha: string;
  readonly headSha: string;
  readonly mergeable: string | null;
  readonly mergeStateStatus: string | null;
  readonly reviewDecision: string | null;
  readonly labelNames: readonly string[];
  readonly requestedReviewerLogins: readonly string[];
};

export type GithubReader = {
  readonly resolveTokenLogin: (githubToken: string) => Promise<string>;
  readonly readRepositoryPrivacy: (githubToken: string) => Promise<boolean>;
  readonly listOpenPullRequests: () => Promise<readonly GithubPullSummary[]>;
  readonly resolvePullAuthor: (prNumber: number) => Promise<string | null>;
  readonly listCheckBuckets: (
    prNumber: number,
  ) => Promise<readonly ("pass" | "fail" | "pending" | "cancel" | "skipping")[]>;
};

export type CheckBucket = Awaited<ReturnType<GithubReader["listCheckBuckets"]>>[number];
