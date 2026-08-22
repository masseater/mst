import { resolve } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND } from "@mst/repository-checks";
import { defineCommand } from "citty";
import { isAgent, isColorSupported } from "std-env";

import { checkReportLines } from "./check-report-lines.ts";
import { defaultEntryCompositionConfig } from "./entry-composition/config.ts";
import { writeEntryComposition } from "./entry-composition/write-entry-composition.ts";
import { defaultIntentSkillsConfig } from "./intent-skills/config.ts";
import { writeSkillVersions } from "./intent-skills/write-skill-versions.ts";
import { isDirectory } from "./lint/oxlint/lib/canonical-values/source-files.ts";
import { runChecks } from "./run-checks.ts";
import { scanTraceFor } from "./scan-trace/scan-trace-report.ts";

const REPOSITORY_ROOT_FLAG = "--repository-root";

const WRITE_FLAG = "--write";

const KNOWN_FLAGS = [REPOSITORY_ROOT_FLAG, WRITE_FLAG];

const flagsIn = (commandLine: readonly string[]): readonly string[] =>
  commandLine.filter((token) => token.startsWith("-")).map((token) => token.replace(/=.*$/u, ""));

const refuseMisuse = (complaint: string): void => {
  process.stderr.write(complaint);
  process.exitCode = EXIT_MISUSE;
};

const repairGeneratedParts = (repositoryRoot: string): boolean => {
  const failures = [
    writeEntryComposition({ repositoryRoot, config: defaultEntryCompositionConfig }),
    writeSkillVersions({ repositoryRoot, config: defaultIntentSkillsConfig }),
  ].flatMap((written) => written.failures);
  if (failures.length === 0) return true;
  refuseMisuse(failures.map((failure) => `${failure}\n`).join(""));
  return false;
};

const reportProblems = (repositoryRoot: string): void => {
  const { outcomes, problems, warnings, failures } = runChecks(repositoryRoot);
  const lines = checkReportLines({ problems, warnings });
  if (lines.length > 0) process.stdout.write(lines.map((line) => `${line}\n`).join(""));
  process.stderr.write(scanTraceFor({ outcomes, readByAgent: isAgent, colored: isColorSupported }));
  if (failures.length > 0) {
    refuseMisuse(failures.map((failure) => `${failure}\n`).join(""));
    return;
  }
  if (problems.length > 0) process.exitCode = EXIT_PROBLEMS_FOUND;
};

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description:
      "Report every discipline violation the lint toolchain cannot see, including missing or indirect test entries that bypass the auto-discovered config and static coverage settings.",
  },
  args: {
    "repository-root": {
      type: "string",
      description: "Root of the repository to scan (defaults to the current working directory)",
      valueHint: "path",
    },
    write: {
      type: "boolean",
      default: false,
      description:
        "Rewrite the parts this repository decides on its own, entry scripts and shipped skill versions, then re-run the checks",
    },
  },
  run({ args, rawArgs }) {
    const unknownFlags = flagsIn(rawArgs).filter((raised) => !KNOWN_FLAGS.includes(raised));
    if (unknownFlags.length > 0) {
      refuseMisuse(`Unknown option ${unknownFlags.join(", ")}. Run --help for usage.\n`);
      return;
    }

    const repositoryRoot = resolve(args["repository-root"] ?? process.cwd());
    if (!isDirectory(repositoryRoot)) {
      refuseMisuse(`${repositoryRoot} is not a directory that can be scanned.\n`);
      return;
    }

    if (args.write && !repairGeneratedParts(repositoryRoot)) return;

    reportProblems(repositoryRoot);
  },
});
