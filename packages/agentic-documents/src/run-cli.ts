import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  type CliResult,
} from "@mst/repository-checks";
import { attemptAsync } from "es-toolkit";

import { defaultConfig } from "./config.ts";
import { formatProblem } from "./problem.ts";
import { runChecks } from "./run-checks.ts";

const USAGE = `Usage: agentic-documents <command> [options]

Commands:
  check   Report every place where a document disagrees with the repository or breaks the normative notation.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
  --write                   Rewrite generated regions instead of reporting them as stale.
`;

const CHECK_COMMAND = "check";

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
  if (command !== CHECK_COMMAND) {
    return { exitCode: EXIT_MISUSE, out: "", error: USAGE };
  }

  const problems = await runChecks({
    repositoryRoot: resolve(parsedNode.values["repository-root"] ?? process.cwd()),
    config: defaultConfig,
    write: parsedNode.values.write,
  });

  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: problems.map((problem) => `${formatProblem(problem)}\n`).join(""),
    error: "",
  };
};

export const runAgenticDocuments = async (argv: readonly string[]): Promise<CliResult> => {
  const [failure, checked] = await attemptAsync<CliResult, Error>(async () => dispatch(argv));
  return failure === null
    ? checked
    : { exitCode: EXIT_MISUSE, out: "", error: `${failure.message}\n` };
};
