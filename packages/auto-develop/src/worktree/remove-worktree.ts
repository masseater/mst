import { resolveCurrentBranch, resolveDefaultBranch } from "./default-branch.ts";
import { indicatesNotAWorkingTree, type GitRunner } from "./git-runner.ts";
import { cleanupWorktreeMetadata } from "./metadata-cleanup.ts";
import { isManagedWorktreePath, resolveRealPath } from "./paths.ts";
import { isProtectedBranch } from "./protected-branch.ts";

import type { Logger } from "../logging/logger.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

export type RemoveContext = {
  readonly git: GitRunner;
  readonly repoDir: string;
  readonly sharedGitDir: string;
  readonly fs: WorktreeFs;
  readonly log: Logger;
};

const guardsReject = (guarding: {
  readonly worktreePath: string;
  readonly repoDir: string;
  readonly log: Logger;
}): boolean => {
  if (!isManagedWorktreePath(guarding.worktreePath)) {
    guarding.log.warn(
      { worktreePath: guarding.worktreePath },
      "refusing to remove an unmanaged path",
    );
    return true;
  }
  if (resolveRealPath(guarding.worktreePath) === resolveRealPath(guarding.repoDir)) {
    guarding.log.warn(
      { worktreePath: guarding.worktreePath },
      "refusing to remove the repository root",
    );
    return true;
  }
  return false;
};

const isProtectedWorktree = async (protection: {
  readonly context: RemoveContext;
  readonly worktreePath: string;
}): Promise<boolean> => {
  const branch = await resolveCurrentBranch({
    git: protection.context.git,
    worktreePath: protection.worktreePath,
    log: protection.context.log,
  });
  const defaultBranch = await resolveDefaultBranch({
    git: protection.context.git,
    repoDir: protection.context.repoDir,
    log: protection.context.log,
  });
  return isProtectedBranch({ branch, defaultBranch });
};

const deleteExistingWorktree = async (deletion: {
  readonly context: RemoveContext;
  readonly worktreePath: string;
}): Promise<void> => {
  const { context, worktreePath } = deletion;
  try {
    await context.git.run({
      args: ["worktree", "remove", "--force", "--force", worktreePath],
      cwd: context.repoDir,
    });
  } catch (removeFailure) {
    if (!indicatesNotAWorkingTree(removeFailure)) throw removeFailure;
    context.fs.removeRecursive(worktreePath);
  }
  if (context.fs.exists(worktreePath)) context.fs.removeRecursive(worktreePath);
};

const deleteThenCleanup = async (deleting: {
  readonly context: RemoveContext;
  readonly worktreePath: string;
}): Promise<void> => {
  if (await isProtectedWorktree(deleting)) {
    deleting.context.log.warn(
      { worktreePath: deleting.worktreePath },
      "refusing to remove a protected worktree",
    );
    return;
  }
  await deleteExistingWorktree(deleting);
  await cleanupWorktreeMetadata({ ...deleting.context, worktreePath: deleting.worktreePath });
};

export const removeWorktree = async (removal: {
  readonly context: RemoveContext;
  readonly worktreePath: string;
}): Promise<void> => {
  const { context, worktreePath } = removal;
  if (guardsReject({ worktreePath, repoDir: context.repoDir, log: context.log })) return;
  if (!context.fs.exists(worktreePath)) {
    await cleanupWorktreeMetadata({ ...context, worktreePath });
    return;
  }
  await deleteThenCleanup({ context, worktreePath });
};
