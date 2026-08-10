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

import { formatProblem } from "./problem.ts";
import { compareRevisions } from "./repository-comparison.ts";
import { runChecks } from "./run-checks.ts";

const USAGE = `Usage: stop-ai-slop check --base <revision> --head <revision> [--repository-root <path>]

Commands:
  check   Run every registered check in definition order.

Options:
  --base <revision>         Git revision before the change.
  --head <revision>         Git revision after the change.
  --repository-root <path>  Root of the Git repository. Defaults to the current working directory.
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
    if (failure instanceof TypeError) return null;
    throw failure;
  }
};

const dispatch = async (argv: readonly string[]): Promise<CliResult> => {
  const parsed = parsedArguments(argv);
  if (parsed === null) return misuse();
  if (parsed.positionals.length !== 1 || parsed.positionals[0] !== "check") return misuse();

  const { base, head } = parsed.values;
  if (base === undefined || base === "" || head === undefined || head === "") return misuse();

  const comparison = await compareRevisions({
    repositoryRoot: resolve(parsed.values["repository-root"] ?? process.cwd()),
    baseRevision: base,
    headRevision: head,
  });
  const problems = runChecks({ comparison });
  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: toLines(problems.map(formatProblem)),
    error: "",
  };
};

export const runStopAiSlop = createCliRunner(dispatch);
