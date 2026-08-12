import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  createCliRunner,
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  type CliResult,
} from "@mst/repository-checks";

import { type ComparisonRange } from "./comparison-range.ts";
import { githubRequestFor } from "./github-request.ts";
import { formatProblem } from "./problem.ts";
import { compareRevisions, type RepositoryComparison } from "./repository-comparison.ts";
import { resolvedComparison } from "./resolved-comparison.ts";
import { runChecks } from "./run-checks.ts";

const USAGE = `Usage: stop-ai-slop check [--base <revision> --head <revision>] [--repository-root <path>]

Commands:
  check   Run every registered check in definition order.

Options:
  --base <revision>         Git revision before the change. Requires --head.
  --head <revision>         Git revision after the change. Requires --base.
  --repository-root <path>  Root of the Git repository. Defaults to the current working directory.

Without --base and --head the change on its way into the integration branch is compared:
the branch being merged when a merge is in progress, and the history since it left
origin/main otherwise.
`;

const misuse = (): CliResult => ({ exitCode: EXIT_MISUSE, out: "", error: USAGE });

const parsedArguments = (argv: readonly string[]) => {
  try {
    return parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        base: { type: "string" },
        head: { type: "string" },
        "repository-root": { type: "string" },
      },
    });
  } catch (failure) {
    return { failure };
  }
};

const namedRange = (base: string | undefined, head: string | undefined): ComparisonRange | null =>
  base === undefined || base === "" || head === undefined || head === ""
    ? null
    : { baseRevision: base, headRevision: head };

const reportedComparison = (comparison: RepositoryComparison): CliResult => {
  const problems = runChecks({ comparison });
  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: problems.map((problem) => `${formatProblem(problem)}\n`).join(""),
    error: "",
  };
};

const comparisonFor = async (
  repositoryRoot: string,
  named: ComparisonRange | null,
): Promise<RepositoryComparison> =>
  named === null
    ? resolvedComparison(repositoryRoot, {
        repository: process.env.GITHUB_REPOSITORY,
        request: githubRequestFor(process.env.GITHUB_TOKEN),
      })
    : compareRevisions({ repositoryRoot, ...named });

const dispatch = async (argv: readonly string[]): Promise<CliResult> => {
  const parsedNode = parsedArguments(argv);
  if ("failure" in parsedNode) return misuse();
  if (parsedNode.positionals.length !== 1 || parsedNode.positionals[0] !== "check") return misuse();

  const { base, head } = parsedNode.values;
  const named = namedRange(base, head);
  if (named === null && (base !== undefined || head !== undefined)) return misuse();

  const repositoryRoot = resolve(parsedNode.values["repository-root"] ?? process.cwd());
  return reportedComparison(await comparisonFor(repositoryRoot, named));
};

export const runStopAiSlop = createCliRunner(dispatch);
