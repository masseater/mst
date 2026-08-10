import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { toLines } from "@mst/utils";
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

export type CliResult = {
  readonly exitCode: number;
  readonly out: string;
  readonly error: string;
};

const EXIT_SUCCESS = 0;

const EXIT_PROBLEMS_FOUND = 1;

const EXIT_MISUSE = 2;

const CHECK_COMMAND = "check";

const dispatch = async (argv: readonly string[]): Promise<CliResult> => {
  const parsed = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      "repository-root": { type: "string" },
      write: { type: "boolean", default: false },
    },
  });

  const [command] = parsed.positionals;
  if (command !== CHECK_COMMAND) {
    return { exitCode: EXIT_MISUSE, out: "", error: USAGE };
  }

  const problems = await runChecks({
    repositoryRoot: resolve(parsed.values["repository-root"] ?? process.cwd()),
    config: defaultConfig,
    write: parsed.values.write,
  });

  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: toLines(problems.map(formatProblem)),
    error: "",
  };
};

export const runAgenticDocuments = async (argv: readonly string[]): Promise<CliResult> => {
  const [failure, result] = await attemptAsync(() => dispatch(argv));
  if (result !== null) return result;

  return {
    exitCode: EXIT_MISUSE,
    out: "",
    error: `${failure instanceof Error ? failure.message : String(failure)}\n`,
  };
};
