/** @canonical-values auto-develop.check-bucket */
const CHECK_BUCKETS = ["pass", "fail", "pending", "cancel", "skipping"] as const;

export const CHECK_BUCKET = {
  pass: CHECK_BUCKETS[0],
  fail: CHECK_BUCKETS[1],
  pending: CHECK_BUCKETS[2],
  cancel: CHECK_BUCKETS[3],
  skipping: CHECK_BUCKETS[4],
} as const;

export type CheckBucket = (typeof CHECK_BUCKETS)[number];

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
  readonly listCheckBuckets: (prNumber: number) => Promise<readonly CheckBucket[]>;
};
