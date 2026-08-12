import { statSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  EXIT_MISUSE,
  EXIT_PROBLEMS_FOUND,
  EXIT_SUCCESS,
  readUnlessMissing,
  type CliResult,
} from "@mst/repository-checks";
import { attempt } from "es-toolkit";

import {
  formatLintRuleIndexProblem,
  lintRuleIndexProblems,
} from "./rule-index/reconcile-rule-index.ts";

const USAGE = `Usage: lint-rule-authoring check [--write] [--repository-root <path>]

Reconciles every workspace lint rule index (docs/lint/index.md) with the rule
implementations found under the directories that the workspace manifests declare
in their lintRules field. Without --write it only reports the indexes that are
missing, unmarked, or stale; with --write it regenerates the generated region of
each index. Exits non-zero when a problem remains.

Options:
  --write                   Write the regenerated indexes instead of only reporting them.
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

const scannableDirectory = (candidatePath: string): boolean =>
  readUnlessMissing(() => statSync(candidatePath))?.isDirectory() === true;

const dispatch = (argv: readonly string[]): CliResult => {
  const parsed = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { "repository-root": { type: "string" }, write: { type: "boolean" } },
  });
  const [command] = parsed.positionals;
  if (command !== "check") {
    return { exitCode: EXIT_MISUSE, out: "", error: USAGE };
  }

  const repositoryRoot = resolve(parsed.values["repository-root"] ?? process.cwd());
  if (!scannableDirectory(repositoryRoot)) {
    return {
      exitCode: EXIT_MISUSE,
      out: "",
      error: `${repositoryRoot} is not a directory that can be scanned.\n`,
    };
  }

  const problems = lintRuleIndexProblems({ repositoryRoot, write: parsed.values.write ?? false });
  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: problems.map((problem) => `${formatLintRuleIndexProblem(problem)}\n`).join(""),
    error: "",
  };
};

export const runLintRuleAuthoring = (argv: readonly string[]): CliResult => {
  const [failure, outcome] = attempt<CliResult, Error>(() => dispatch(argv));
  return failure === null
    ? outcome
    : { exitCode: EXIT_MISUSE, out: "", error: `${failure.message}\n` };
};
