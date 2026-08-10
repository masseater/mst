import parseGitDiff, { type GitDiff } from "parse-git-diff";

export const parseRepositoryDiff = (diff: string): GitDiff => {
  const parsed = parseGitDiff(diff);
  if (diff.trim().length > 0 && parsed.files.length === 0) {
    throw new Error("Unable to parse non-empty Git diff");
  }
  return parsed;
};
