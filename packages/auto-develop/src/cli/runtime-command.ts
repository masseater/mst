import { EXIT_MISUSE } from "@mst/repository-checks";
import { defineCommand } from "citty";

import { readEnvVar } from "../config/env.ts";
import { runConfigSchema } from "../config/run-config.ts";
import { DECLARED_MODE, type Mode } from "../contract/vocabulary.ts";
import { buildContextCommand } from "./build-context-command.ts";
import { runMode } from "./run-mode.ts";

const DEFAULT_CONCURRENCY = "3";

const ENGINE_TIMEOUT_MS = 72 * 60 * 60 * 1000;

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
        .map((listed) => Number(listed.trim()))
        .filter((parsedNode) => Number.isInteger(parsedNode) && parsedNode > 0);

const positiveIntegerFrom = (raw: string, fallback: number): number => {
  const parsedNode = Number(raw);
  return Number.isInteger(parsedNode) && parsedNode > 0 ? parsedNode : fallback;
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
}): Promise<void> => {
  const relayOrigin = readEnvVar("AUTO_DEVELOP_RELAY_ORIGIN");
  const repository = readEnvVar("GITHUB_REPOSITORY");
  const githubToken = readEnvVar("GH_TOKEN") ?? readEnvVar("GITHUB_TOKEN");
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
  await runMode({
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

const reviewerCommand = defineCommand({
  meta: {
    name: DECLARED_MODE.reviewer,
    description: "Review pull requests as they are requested.",
  },
  args: runtimeArgs,
  run: ({ args }) => startRuntime({ mode: DECLARED_MODE.reviewer, args }),
});

const authorCommand = defineCommand({
  meta: {
    name: DECLARED_MODE.author,
    description: "Answer review feedback, CI failures and base updates.",
  },
  args: runtimeArgs,
  run: ({ args }) => startRuntime({ mode: DECLARED_MODE.author, args }),
});

export const autoDevelopCommand = defineCommand({
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
