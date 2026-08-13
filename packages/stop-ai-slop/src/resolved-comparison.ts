import { comparisonRangeIn } from "./comparison-range.ts";
import { runGitText } from "./git-text.ts";
import { compareGitHubPullRequest, type GitHubRequest } from "./github-comparison.ts";
import { compareRevisions, type RepositoryComparison } from "./repository-comparison.ts";

const PARENT_PREFIX = "parent ";

const parentsOf = async (repositoryRoot: string): Promise<readonly string[]> =>
  (await runGitText({ repositoryRoot, args: ["cat-file", "commit", "HEAD"] }))
    .split("\n")
    .filter((line) => line.startsWith(PARENT_PREFIX))
    .map((line) => line.slice(PARENT_PREFIX.length));

export type ComparisonEnvironment = Readonly<{
  repository: string | undefined;
  request: GitHubRequest | null;
}>;

export const resolvedComparison = async (
  repositoryRoot: string,
  environment: ComparisonEnvironment,
): Promise<RepositoryComparison> => {
  const range = await comparisonRangeIn(repositoryRoot);
  if (range !== null) return compareRevisions({ repositoryRoot, ...range });

  const [base, head] = await parentsOf(repositoryRoot);
  const { repository, request } = environment;
  if (repository === undefined || request === null || base === undefined || head === undefined) {
    throw new Error(
      "Do not leave the compared change to guesswork: this checkout holds neither origin/main nor a pull request merge to read. Fetch the integration branch, or name both ends with --base and --head.",
    );
  }

  return compareGitHubPullRequest({
    repositoryRoot,
    repository,
    baseRevision: base,
    headRevision: head,
    request,
  });
};
