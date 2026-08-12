import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  createCliRunner,
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  type CliResult,
} from "@mst/repository-checks";

import { formatSpecificationProblem } from "./problem.ts";
import { runChecks } from "./run-checks.ts";

const USAGE = `Usage: verified-specifications <command> [options]

Commands:
  check   Extract the claims of every specification test and report each place where the structure cannot be read or a SPECIFICATIONS.md disagrees with them.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
  --write                   Rewrite each SPECIFICATIONS.md instead of reporting it as stale.
`;

const dispatch = async (argv: readonly string[]): Promise<CliResult> => {
  const parsedNode = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      "repository-root": { type: "string" },
      write: { type: "boolean", default: false },
    },
  });

  const [command] = parsedNode.positionals;
  if (command !== "check") {
    return { exitCode: EXIT_MISUSE, out: "", error: USAGE };
  }

  const problems = await runChecks({
    repositoryRoot: resolve(parsedNode.values["repository-root"] ?? process.cwd()),
    write: parsedNode.values.write,
  });

  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: problems.map((problem) => `${formatSpecificationProblem(problem)}\n`).join(""),
    error: "",
  };
};

export const runVerifiedSpecifications = createCliRunner(dispatch);
