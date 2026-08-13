export const UNKNOWN_BRANCH_MARKER = "__unknown__";

const ALWAYS_PROTECTED = ["main", "master"];

export const isProtectedBranch = (protection: {
  readonly branch: string | null;
  readonly defaultBranch: string | null;
}): boolean => {
  if (protection.defaultBranch === null) return true;
  if (protection.branch === null) return false;
  if (protection.branch === UNKNOWN_BRANCH_MARKER) return true;
  return (
    protection.branch === protection.defaultBranch || ALWAYS_PROTECTED.includes(protection.branch)
  );
};
