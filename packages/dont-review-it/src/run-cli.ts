import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  failureMessage,
  toLines,
  type CliResult,
} from "@mst/utils";
import { attempt } from "es-toolkit";

import { isDirectory } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import { runChecks } from "./run-checks.ts";

const USAGE = `Usage: dont-review-it check [--repository-root <path>]

Reports every canonical values annotation that is broken or retired, every value set
that more than one concept declares, every body that more than one declaration spells
the same way, every workflow definition that narrows its own start, hides a failure,
holds logic, or leaves its permissions unstated, every pnpm catalog entry or
dependency pin that keeps a version declared in the wrong place, and every package
whose TanStack Intent skills disagree with its manifest: a publishable package
shipping none, or a workspace-internal package carrying them. Exits non-zero when
any of them is found. Manifests whose versions disagree with each other or with the
catalog are printed as warnings and do not fail the run.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

const dispatch = (argv: readonly string[]): CliResult => {
  const parsed = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { "repository-root": { type: "string" } },
  });
  const [command] = parsed.positionals;
  if (command !== "check") {
    return { exitCode: EXIT_MISUSE, out: "", error: USAGE };
  }

  const repositoryRoot = resolve(parsed.values["repository-root"] ?? process.cwd());
  if (!isDirectory(repositoryRoot)) {
    return {
      exitCode: EXIT_MISUSE,
      out: "",
      error: `${repositoryRoot} is not a directory that can be scanned.\n`,
    };
  }

  const { problems, warnings } = runChecks(repositoryRoot);
  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: toLines([...problems, ...warnings.map((warning) => `warning: ${warning}`)]),
    error: "",
  };
};

export const runDontReviewIt = (argv: readonly string[]): CliResult => {
  const [failure, result] = attempt(() => dispatch(argv));
  if (result !== null) return result;

  return {
    exitCode: EXIT_MISUSE,
    out: "",
    error: `${failureMessage(failure)}\n`,
  };
};
