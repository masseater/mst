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

import { formatLintRuleProblem } from "./lint-rule-problem.ts";
import { lintRuleDocProblems } from "./rule-docs/reconcile-rule-doc.ts";
import { lintRuleIndexProblems } from "./rule-index/reconcile-rule-index.ts";

const USAGE = `Usage: lint-rule-authoring check [--write] [--repository-root <path>]

Reconciles every workspace lint rule index (docs/lint/index.md) and every rule
document (docs/lint/<rule>.md) with the rule implementations found under the
directories that the workspace manifests declare in their lintRules field.
Without --write it only reports what is missing, unmarked, stale, or still
carrying the text a seeded document was written with; with --write it seeds the
absent documents and regenerates every generated region. Exits non-zero when a
problem remains.

Options:
  --write                   Write the regenerated documents instead of only reporting them.
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

const scannableDirectory = (candidatePath: string): boolean =>
  readUnlessMissing(() => statSync(candidatePath))?.isDirectory() === true;

const dispatch = (argv: readonly string[]): CliResult => {
  const parsedNode = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { "repository-root": { type: "string" }, write: { type: "boolean" } },
  });
  const [command] = parsedNode.positionals;
  if (command !== "check") {
    return { exitCode: EXIT_MISUSE, out: "", error: USAGE };
  }

  const repositoryRoot = resolve(parsedNode.values["repository-root"] ?? process.cwd());
  if (!scannableDirectory(repositoryRoot)) {
    return {
      exitCode: EXIT_MISUSE,
      out: "",
      error: `${repositoryRoot} is not a directory that can be scanned.\n`,
    };
  }

  const write = parsedNode.values.write ?? false;
  const problems = [
    ...lintRuleIndexProblems({ repositoryRoot, write }).problems,
    ...lintRuleDocProblems({ repositoryRoot, write }).problems,
  ];
  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: problems.map((problem) => `${formatLintRuleProblem(problem)}\n`).join(""),
    error: "",
  };
};

export const runLintRuleAuthoring = (argv: readonly string[]): CliResult => {
  const [failure, ranCheck] = attempt<CliResult, Error>(() => dispatch(argv));
  return failure === null
    ? ranCheck
    : { exitCode: EXIT_MISUSE, out: "", error: `${failure.message}\n` };
};
