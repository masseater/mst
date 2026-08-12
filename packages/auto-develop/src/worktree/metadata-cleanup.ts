import { basename, join } from "node:path";

import type { Logger } from "../logging/logger.ts";
import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

export const cleanupWorktreeMetadata = async (cleanup: {
  readonly git: GitRunner;
  readonly repoDir: string;
  readonly worktreePath: string;
  readonly fs: WorktreeFs;
  readonly sharedGitDir: string;
  readonly log: Logger;
}): Promise<void> => {
  try {
    await cleanup.git.run({ args: ["worktree", "prune"], cwd: cleanup.repoDir });
  } catch (pruneFailure) {
    cleanup.log.warn({ err: pruneFailure }, "worktree prune failed");
  }
  try {
    cleanup.fs.removeRecursive(
      join(cleanup.sharedGitDir, "worktrees", basename(cleanup.worktreePath)),
    );
  } catch (removeFailure) {
    cleanup.log.warn({ err: removeFailure }, "removing worktree metadata directory failed");
  }
};
