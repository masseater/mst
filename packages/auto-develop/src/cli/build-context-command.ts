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
import { createGitRunner } from "../runtime/node-adapters.ts";
import { runContextFsOnDisk } from "./run-context-fs.ts";

const emptyGithubContext: PrContextGithub = {
  commentContext: () =>
    Promise.resolve({ reviews: [], prComments: [], inlineComments: [], threads: [] }),
  ciContext: () => Promise.resolve({ checks: [], failedLogPaths: [] }),
};

const gitFor = (cwd: string): PrContextGit => {
  const git = createGitRunner();
  return {
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
      return listed.stdout.trim().split(/\s+/u)[0] ?? null;
    },
    showFile: async (entry) =>
      (await git.run({ args: ["show", `${entry.ref}:${entry.path}`], cwd })).stdout,
  };
};

const writeContextFor = async (writing: {
  readonly prNumber: number;
  readonly base: string;
  readonly head: string;
}): Promise<readonly string[]> => {
  const repoDir = resolveRepositoryRoot(process.cwd());
  const runId = runIdFor({ prNumber: writing.prNumber, isoTime: new Date().toISOString() });
  const outputDir = join(repoDir, ".repo-workflow", "review-context", runId);
  const context = await collectPrContext({
    git: gitFor(repoDir),
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

export const buildContextCommand = defineCommand({
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
      process.stderr.write("--pr must be a positive integer and --base and --head are required\n");
      process.exitCode = EXIT_MISUSE;
      return;
    }
    const written = await writeContextFor({ prNumber, base: args.base, head: args.head });
    process.stdout.write(`${[`wrote the context for PR #${prNumber}`, ...written].join("\n")}\n`);
  },
});
