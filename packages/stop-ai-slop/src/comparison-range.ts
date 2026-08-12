import { attemptAsync } from "es-toolkit";

import { runGitText } from "./git-text.ts";

export type ComparisonRange = Readonly<{
  baseRevision: string;
  headRevision: string;
}>;

const INTEGRATION_REVISION = "origin/main";

const UNKNOWN_REVISION_STATUS = 1;

const exitStatusOf = (failure: unknown): number | null => {
  if (typeof failure !== "object" || failure === null) return null;
  if (!("code" in failure)) return null;
  return typeof failure.code === "number" ? failure.code : null;
};

const commitOrNull = async (repositoryRoot: string, revision: string): Promise<string | null> => {
  const [unreadableRevision, resolved] = await attemptAsync(async () =>
    runGitText({
      repositoryRoot,
      args: ["rev-parse", "--verify", "--quiet", "--end-of-options", `${revision}^{commit}`],
    }),
  );
  if (resolved !== null) return resolved.trim();
  if (exitStatusOf(unreadableRevision) === UNKNOWN_REVISION_STATUS) return null;
  throw new Error(`Do not read past a broken ${revision}; repair the repository first.`, {
    cause: unreadableRevision,
  });
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
