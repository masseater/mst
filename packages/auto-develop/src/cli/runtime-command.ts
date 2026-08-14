import { EXIT_MISUSE } from "@mst/repository-checks";
import { defineCommand } from "citty";

import { runConfigSchema } from "../config/run-config.ts";
import { createGitRunner } from "../runtime/node-adapters.ts";
import { createBuildContextCommand, createBuildContextWriter } from "./build-context-command.ts";

import type { Mode } from "../contract/vocabulary.ts";
import type { ModeRunRequest } from "./run-mode.ts";

const DEFAULT_CONCURRENCY = "3";

const ENGINE_TIMEOUT_MS = 72 * 60 * 60 * 1000;

const buildContextCommand = createBuildContextCommand({
  writeContext: createBuildContextWriter({
    currentDirectory: process.cwd.bind(process),
    git: createGitRunner(),
    now: Date.now.bind(Date),
  }),
});

const runtimeArgs = {
  concurrency: {
    type: "string",
    description: "how many PR jobs run at once",
    default: DEFAULT_CONCURRENCY,
    valueHint: "count",
  },
  "dry-run": { type: "boolean", description: "skip every write to GitHub", default: false },
  pr: {
    type: "string",
    description: "limit the run to these PR numbers (comma separated)",
    valueHint: "numbers",
  },
  "exclude-pr": {
    type: "string",
    description: "keep these PR numbers out of the run (comma separated)",
    valueHint: "numbers",
  },
  "gh-user": {
    type: "string",
    description: "act as this GitHub login",
    valueHint: "login",
  },
  "dangerously-skip-permissions": {
    type: "boolean",
    description: "let the agent CLI run every tool without asking",
    default: false,
  },
} as const;

const prNumbersFrom = (raw: string | undefined): readonly number[] =>
  raw === undefined
    ? []
    : raw
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter((parsed) => Number.isInteger(parsed) && parsed > 0);

const positiveIntegerFrom = (raw: string, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

type RuntimeCommandDependencies = {
  readonly readEnvironment: (name: string) => string | undefined;
  readonly runMode: (request: ModeRunRequest) => Promise<void>;
};

const startRuntime = async (start: {
  readonly mode: Mode;
  readonly args: {
    readonly concurrency: string;
    readonly "dry-run": boolean;
    readonly pr?: string;
    readonly "exclude-pr"?: string;
    readonly "gh-user"?: string;
    readonly "dangerously-skip-permissions": boolean;
  };
  readonly dependencies: RuntimeCommandDependencies;
}): Promise<void> => {
  const relayOrigin = start.dependencies.readEnvironment("AUTO_DEVELOP_RELAY_ORIGIN");
  const repository = start.dependencies.readEnvironment("GITHUB_REPOSITORY");
  const githubToken =
    start.dependencies.readEnvironment("GH_TOKEN") ??
    start.dependencies.readEnvironment("GITHUB_TOKEN");
  if (relayOrigin === undefined || repository === undefined || githubToken === undefined) {
    process.stderr.write(
      "AUTO_DEVELOP_RELAY_ORIGIN, GITHUB_REPOSITORY and GH_TOKEN (or GITHUB_TOKEN) must be set\n",
    );
    process.exitCode = EXIT_MISUSE;
    return;
  }
  const config = runConfigSchema.parse({
    concurrency: positiveIntegerFrom(start.args.concurrency, 3),
    dryRun: start.args["dry-run"],
    targetPrs: prNumbersFrom(start.args.pr),
    excludedPrs: prNumbersFrom(start.args["exclude-pr"]),
    ...(start.args["gh-user"] === undefined ? {} : { ghUser: start.args["gh-user"] }),
    dangerouslySkipPermissions: start.args["dangerously-skip-permissions"],
  });
  await start.dependencies.runMode({
    mode: start.mode,
    relayOrigin,
    repository,
    githubToken,
    concurrency: config.concurrency,
    prFilter: { targetPrs: config.targetPrs, excludedPrs: config.excludedPrs },
    dryRun: config.dryRun,
    reviewerLogin: config.ghUser ?? "",
    bypassPermissions: config.dangerouslySkipPermissions,
    engineTimeoutMs: ENGINE_TIMEOUT_MS,
  });
};

export const createAutoDevelopCommand = (dependencies: RuntimeCommandDependencies) => {
  const reviewerCommand = defineCommand({
    meta: { name: "reviewer", description: "Review pull requests as they are requested." },
    args: runtimeArgs,
    run: ({ args }) => startRuntime({ mode: "reviewer", args, dependencies }),
  });

  const authorCommand = defineCommand({
    meta: { name: "author", description: "Answer review feedback, CI failures and base updates." },
    args: runtimeArgs,
    run: ({ args }) => startRuntime({ mode: "author", args, dependencies }),
  });

  return defineCommand({
    meta: {
      name: "auto-develop",
      description: "Keep a pull-request review loop running without a human starting it.",
    },
    subCommands: {
      reviewer: reviewerCommand,
      author: authorCommand,
      "build-pr-context": buildContextCommand,
    },
  });
};
