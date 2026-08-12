import { resolve } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND } from "@mst/repository-checks";
import { defineCommand } from "citty";

import { isDirectory } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import { runChecks } from "./run-checks.ts";

const REPOSITORY_ROOT_FLAG = "--repository-root";

const flagsIn = (rawArgs: readonly string[]): readonly string[] =>
  rawArgs.filter((token) => token.startsWith("-")).map((token) => token.replace(/=.*$/u, ""));

const refuseMisuse = (message: string): void => {
  process.stderr.write(message);
  process.exitCode = EXIT_MISUSE;
};

const reportProblems = (repositoryRoot: string): void => {
  const { problems } = runChecks(repositoryRoot);
  if (problems.length > 0) {
    process.stdout.write(problems.map((problem) => `${problem}\n`).join(""));
  }
  if (problems.length > 0) process.exitCode = EXIT_PROBLEMS_FOUND;
};

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description:
      "Report every discipline violation the lint toolchain cannot see, including test commands that replace the auto-discovered config or override static coverage settings.",
  },
  args: {
    "repository-root": {
      type: "string",
      description: "Root of the repository to scan (defaults to the current working directory)",
      valueHint: "path",
    },
  },
  run({ args, rawArgs }) {
    const unknownFlags = flagsIn(rawArgs).filter((flag) => flag !== REPOSITORY_ROOT_FLAG);
    if (unknownFlags.length > 0) {
      refuseMisuse(`Unknown option ${unknownFlags.join(", ")}. Run --help for usage.\n`);
      return;
    }

    const repositoryRoot = resolve(args["repository-root"] ?? process.cwd());
    if (!isDirectory(repositoryRoot)) {
      refuseMisuse(`${repositoryRoot} is not a directory that can be scanned.\n`);
      return;
    }

    reportProblems(repositoryRoot);
  },
});
