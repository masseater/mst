import { resolve } from "node:path";
import { parseArgs } from "node:util";

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

export type CliStreams = {
  readonly writeOut: (text: string) => void;
  readonly writeError: (text: string) => void;
};

const EXIT_SUCCESS = 0;

const EXIT_PROBLEMS_FOUND = 1;

const EXIT_MISUSE = 2;

const VERIFY_COMMAND = "verify";

const EQUIVALENT_CONCEPTS_COMMAND = "equivalent-concepts";

const dispatch = (argv: readonly string[], streams: CliStreams): number => {
  const parsed = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { "repository-root": { type: "string" } },
  });
  const [command] = parsed.positionals;
  if (command !== VERIFY_COMMAND && command !== EQUIVALENT_CONCEPTS_COMMAND) {
    streams.writeError(USAGE);
    return EXIT_MISUSE;
  }

  const repositoryRoot = resolve(parsed.values["repository-root"] ?? process.cwd());
  if (!isDirectory(repositoryRoot)) {
    streams.writeError(`${repositoryRoot} is not a directory that can be scanned.\n`);
    return EXIT_MISUSE;
  }

  if (command === VERIFY_COMMAND) {
    const problems = verifyCanonicalValues({ repositoryRoot });
    for (const problem of problems) streams.writeOut(`${formatCanonicalValuesProblem(problem)}\n`);
    return problems.length === 0 ? EXIT_SUCCESS : EXIT_PROBLEMS_FOUND;
  }

  const catalog = buildCanonicalValuesCatalog({ repositoryRoot });
  for (const group of findEquivalentConcepts(catalog.entries)) {
    streams.writeOut(`${formatEquivalentConceptGroup(group)}\n`);
  }
  return EXIT_SUCCESS;
};

export const runDontReviewIt = (argv: readonly string[], streams: CliStreams): number => {
  try {
    return dispatch(argv, streams);
  } catch (error) {
    streams.writeError(`${error instanceof Error ? error.message : String(error)}\n`);
    return EXIT_MISUSE;
  }
};
