import { isAbsolute, resolve } from "node:path";

import type { GitRunner } from "./git-runner.ts";

export type GitOperations = {
  readonly hasUncommittedChanges: () => Promise<boolean>;
  readonly porcelainStatus: () => Promise<string>;
  readonly commitAll: (message: string) => Promise<void>;
  readonly push: () => Promise<void>;
  readonly mergeRemoteBranch: (branch: string) => Promise<void>;
  readonly topLevelPath: () => Promise<string | null>;
  readonly sharedGitDirPath: () => Promise<string | null>;
};

const absoluteFrom = (cwd: string, output: string): string | null => {
  const trimmed = output.trim();
  if (trimmed === "") return null;
  return isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
};

export const createGitOperations = (context: {
  readonly git: GitRunner;
  readonly cwd: string;
}): GitOperations => {
  const run = (args: readonly string[]) => context.git.run({ args, cwd: context.cwd });

  const resolvedPathOf = async (args: readonly string[]): Promise<string | null> => {
    try {
      const { stdout } = await run(args);
      return absoluteFrom(context.cwd, stdout);
    } catch (pathFailure) {
      void pathFailure;
      return null;
    }
  };

  return {
    hasUncommittedChanges: async () => {
      const { stdout } = await run(["status", "--porcelain"]);
      return stdout.trim() !== "";
    },
    porcelainStatus: async () => (await run(["status", "--porcelain"])).stdout,
    commitAll: async (message) => {
      await run(["add", "-A"]);
      await run(["commit", "-m", message]);
    },
    push: async () => {
      await run(["push", "origin", "HEAD"]);
    },
    mergeRemoteBranch: async (branch) => {
      await run(["fetch", "origin", branch]);
      await run(["merge", "--no-ff", `origin/${branch}`]);
    },
    topLevelPath: () => resolvedPathOf(["rev-parse", "--show-toplevel"]),
    sharedGitDirPath: () => resolvedPathOf(["rev-parse", "--git-common-dir"]),
  };
};
