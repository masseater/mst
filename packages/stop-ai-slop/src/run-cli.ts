import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  createCliRunner,
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  toLines,
  type CliResult,
} from "@mst/utils";

import { comparisonRangeIn, type ComparisonRange } from "./comparison-range.ts";
import { formatProblem } from "./problem.ts";
import { compareRevisions } from "./repository-comparison.ts";
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

const reportedComparison = async (
  repositoryRoot: string,
  range: ComparisonRange,
): Promise<CliResult> => {
  const comparison = await compareRevisions({ repositoryRoot, ...range });
  const problems = runChecks({ comparison });
  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: toLines(problems.map(formatProblem)),
    error: "",
  };
};

const dispatch = async (argv: readonly string[]): Promise<CliResult> => {
  const parsed = parsedArguments(argv);
  if ("failure" in parsed) return misuse();
  if (parsed.positionals.length !== 1 || parsed.positionals[0] !== "check") return misuse();

  const { base, head } = parsed.values;
  const named = namedRange(base, head);
  if (named === null && (base !== undefined || head !== undefined)) return misuse();

  const repositoryRoot = resolve(parsed.values["repository-root"] ?? process.cwd());
  return reportedComparison(repositoryRoot, named ?? (await comparisonRangeIn(repositoryRoot)));
};

export const runStopAiSlop = createCliRunner(dispatch);
