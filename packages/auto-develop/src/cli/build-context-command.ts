import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { EXIT_MISUSE } from "@mst/repository-checks";
import { defineCommand } from "citty";

import { resolveRepositoryRoot } from "../config/repository-root.ts";
import {
  collectPrContext,
  type PrContextGit,
  type PrContextGithub,
} from "../context/collect-pr-context.ts";
import { renderMarkdown } from "../context/render-markdown.ts";
import { runIdFor } from "../context/run-context-paths.ts";
import { runContextFsOnDisk } from "./run-context-fs.ts";

import type { GitRunner } from "../worktree/git-runner.ts";

const emptyGithubContext: PrContextGithub = {
  commentContext: () =>
    Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
  ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
};

const gitFor = (cwd: string, git: GitRunner): PrContextGit => ({
  nameStatusDiff: async (ends) =>
    (
      await git.run({
        args: ["diff", "--name-status", "-M", `${ends.base}...${ends.head}`],
        cwd,
      })
    ).stdout,
  unifiedDiff: async (ends) =>
    (await git.run({ args: ["diff", `${ends.base}...${ends.head}`], cwd })).stdout,
  treeEntryMode: async (entry) => {
    const listed = await git.run({ args: ["ls-tree", entry.ref, "--", entry.path], cwd });
    return listed.stdout.trim().replace(/\s.*/su, "");
  },
  showFile: async (entry) =>
    (await git.run({ args: ["show", `${entry.ref}:${entry.path}`], cwd })).stdout,
});

type ContextWriter = (writing: {
  readonly prNumber: number;
  readonly base: string;
  readonly head: string;
}) => Promise<readonly string[]>;

export const createBuildContextWriter =
  (dependencies: {
    readonly currentDirectory: () => string;
    readonly git: GitRunner;
    readonly now: () => number;
  }): ContextWriter =>
  async (writing) => {
    const repoDir = resolveRepositoryRoot(dependencies.currentDirectory());
    const runId = runIdFor({
      prNumber: writing.prNumber,
      isoTime: new Date(dependencies.now()).toISOString(),
    });
    const outputDir = join(repoDir, ".repo-workflow", "review-context", runId);
    const context = await collectPrContext({
      git: gitFor(repoDir, dependencies.git),
      github: emptyGithubContext,
      prNumber: writing.prNumber,
      base: writing.base,
      head: writing.head,
      failedLogsDir: join(outputDir, "ci-logs"),
    });
    runContextFsOnDisk.mkdirRecursive(outputDir);
    runContextFsOnDisk.writeJson(join(outputDir, "review-context.json"), context);
    writeFileSync(join(outputDir, "review-context.md"), `${renderMarkdown(context)}\n`);
    return [join(outputDir, "review-context.json"), join(outputDir, "review-context.md")];
  };

export const createBuildContextCommand = (dependencies: { readonly writeContext: ContextWriter }) =>
  defineCommand({
    meta: {
      name: "build-pr-context",
      description: "Collect the PR context into JSON and Markdown for the agent to read.",
    },
    args: {
      pr: { type: "string", description: "the PR number to collect", valueHint: "number" },
      base: { type: "string", description: "the base ref of the diff", valueHint: "ref" },
      head: { type: "string", description: "the head ref of the diff", valueHint: "ref" },
    },
    run: async ({ args }) => {
      const prNumber = Number(args.pr);
      const usable =
        Number.isInteger(prNumber) &&
        prNumber > 0 &&
        args.base !== undefined &&
        args.head !== undefined;
      if (!usable) {
        process.stderr.write(
          "--pr must be a positive integer and --base and --head are required\n",
        );
        process.exitCode = EXIT_MISUSE;
        return;
      }
      const written = await dependencies.writeContext({
        prNumber,
        base: args.base,
        head: args.head,
      });
      process.stdout.write(`${[`wrote the context for PR #${prNumber}`, ...written].join("\n")}\n`);
    },
  });
