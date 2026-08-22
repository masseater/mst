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

const absoluteFrom = (cwd: string, produced: string): string | null => {
  const trimmed = produced.trim();
  if (trimmed === "") return null;
  return isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed);
};

export const createGitOperations = (carried: {
  readonly git: GitRunner;
  readonly cwd: string;
}): GitOperations => {
  const run = (handedArgs: readonly string[]) =>
    carried.git.run({ args: handedArgs, cwd: carried.cwd });

  const resolvedPathOf = async (handedArgs: readonly string[]): Promise<string | null> => {
    try {
      const { stdout } = await run(handedArgs);
      return absoluteFrom(carried.cwd, stdout);
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
    commitAll: async (complaint) => {
      await run(["add", "-A"]);
      await run(["commit", "-m", complaint]);
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
