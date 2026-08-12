import { runGitText } from "./git-text.ts";

export type ComparisonRange = Readonly<{
  baseRevision: string;
  headRevision: string;
}>;

const INTEGRATION_REVISION = "origin/main";

const commitOrNull = async (repositoryRoot: string, revision: string): Promise<string | null> => {
  const found = (
    await runGitText({
      repositoryRoot,
      args: ["rev-list", "--max-count=1", "--ignore-missing", "--end-of-options", revision],
    })
  ).trim();
  return found === "" ? null : found;
};

const mergeBaseOf = async (
  repositoryRoot: string,
  revisions: readonly [string, string],
): Promise<string> =>
  (await runGitText({ repositoryRoot, args: ["merge-base", ...revisions] })).trim();

export const comparisonRangeIn = async (repositoryRoot: string): Promise<ComparisonRange> => {
  const mergeHead = await commitOrNull(repositoryRoot, "MERGE_HEAD");
  if (mergeHead !== null) {
    return {
      baseRevision: await mergeBaseOf(repositoryRoot, ["HEAD", mergeHead]),
      headRevision: mergeHead,
    };
  }

  const integration = await commitOrNull(repositoryRoot, INTEGRATION_REVISION);
  if (integration === null) {
    throw new Error(
      `Do not leave the compared change to guesswork: ${INTEGRATION_REVISION} is not in this repository. Fetch it, or name both ends with --base and --head.`,
    );
  }

  return {
    baseRevision: await mergeBaseOf(repositoryRoot, [integration, "HEAD"]),
    headRevision: "HEAD",
  };
};
