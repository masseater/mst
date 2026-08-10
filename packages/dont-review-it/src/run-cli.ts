import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { attempt } from "es-toolkit";

import { buildCanonicalValuesCatalog } from "./lint/oxlint/lib/canonical-values/builder.ts";
import { isDirectory } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import {
  findEquivalentConcepts,
  formatCanonicalValuesProblem,
  formatEquivalentConceptGroup,
  verifyCanonicalValues,
} from "./lint/oxlint/lib/canonical-values/verify.ts";

const USAGE = `Usage: dont-review-it <command> [--repository-root <path>]

Commands:
  verify               Report every broken or retired canonical values annotation, and exit non-zero when any is found.
  equivalent-concepts  Report every value set that more than one concept declares.

Options:
  --repository-root <path>  Root of the repository to scan. Defaults to the current working directory.
`;

export type CliResult = {
  readonly exitCode: number;
  readonly out: string;
  readonly error: string;
};

const EXIT_SUCCESS = 0;

const EXIT_PROBLEMS_FOUND = 1;

const EXIT_MISUSE = 2;

const VERIFY_COMMAND = "verify";

const EQUIVALENT_CONCEPTS_COMMAND = "equivalent-concepts";

const asLines = (entries: readonly string[]): string =>
  entries.map((entry) => `${entry}\n`).join("");

const verified = (repositoryRoot: string): CliResult => {
  const problems = verifyCanonicalValues({ repositoryRoot });
  return {
    exitCode: problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND,
    out: asLines(problems.map((problem) => formatCanonicalValuesProblem(problem))),
    error: "",
  };
};

const equivalentConcepts = (repositoryRoot: string): CliResult => {
  const catalog = buildCanonicalValuesCatalog({ repositoryRoot });
  return {
    exitCode: EXIT_SUCCESS,
    out: asLines(
      findEquivalentConcepts(catalog.entries).map((group) => formatEquivalentConceptGroup(group)),
    ),
    error: "",
  };
};

const dispatch = (argv: readonly string[]): CliResult => {
  const parsed = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { "repository-root": { type: "string" } },
  });
  const [command] = parsed.positionals;
  if (command !== VERIFY_COMMAND && command !== EQUIVALENT_CONCEPTS_COMMAND) {
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

  return command === VERIFY_COMMAND ? verified(repositoryRoot) : equivalentConcepts(repositoryRoot);
};

export const runDontReviewIt = (argv: readonly string[]): CliResult => {
  const [failure, result] = attempt(() => dispatch(argv));
  if (result !== null) return result;

  return {
    exitCode: EXIT_MISUSE,
    out: "",
    error: `${failure instanceof Error ? failure.message : String(failure)}\n`,
  };
};
