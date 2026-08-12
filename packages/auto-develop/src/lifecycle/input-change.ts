const DIFF_ENDPOINTS = ["base", "head"] as const;

export type DiffEndpoint = (typeof DIFF_ENDPOINTS)[number];

export type PrInputSnapshot = {
  readonly baseRefName: string;
  readonly headRefOid: string;
};

export const changedEndpoint = (compare: {
  readonly before: PrInputSnapshot;
  readonly after: PrInputSnapshot;
}): DiffEndpoint | null => {
  if (compare.before.baseRefName !== compare.after.baseRefName) return "base";
  if (compare.before.headRefOid !== compare.after.headRefOid) return "head";
  return null;
};
