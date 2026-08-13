import { resolveCurrentBranch } from "./default-branch.ts";
import { worktreePathFor } from "./paths.ts";
import { removeWorktree, type RemoveContext } from "./remove-worktree.ts";
import { listRegisteredWorktrees } from "./worktree-list.ts";

import type { Logger } from "../logging/logger.ts";
import type { GitRunner } from "./git-runner.ts";
import type { WorktreeFs } from "./worktree-fs.ts";

export type AcquireRequest = {
  readonly headBranch: string;
  readonly baseBranch?: string;
  readonly prNumber: number;
};

export type AcquireContext = {
  readonly git: GitRunner;
  readonly repoDir: string;
  readonly sharedGitDir: string;
  readonly fs: WorktreeFs;
  readonly log: Logger;
  readonly now: () => Date;
};

const fetchBranch = (fetching: {
  readonly git: GitRunner;
  readonly repoDir: string;
  readonly branch: string;
}): Promise<unknown> =>
  fetching.git.run({
    args: [
      "fetch",
      "origin",
      `+refs/heads/${fetching.branch}:refs/remotes/origin/${fetching.branch}`,
    ],
    cwd: fetching.repoDir,
  });

const resetAndMark = async (finishing: {
  readonly context: AcquireContext;
  readonly worktreePath: string;
  readonly headBranch: string;
}): Promise<void> => {
  await finishing.context.git.run({
    args: ["reset", "--hard", `origin/${finishing.headBranch}`],
    cwd: finishing.worktreePath,
  });
  finishing.context.fs.writeMarker(finishing.worktreePath, finishing.context.now().toISOString());
};

const isReusable = async (reuse: {
  readonly context: AcquireContext;
  readonly worktreePath: string;
  readonly headBranch: string;
}): Promise<boolean> => {
  const registered = await listRegisteredWorktrees({
    git: reuse.context.git,
    repoDir: reuse.context.repoDir,
  });
  const sameHeadElsewhere = registered.some(
    (worktree) => worktree.branch === reuse.headBranch && worktree.path !== reuse.worktreePath,
  );
  const registeredHere = registered.some((worktree) => worktree.path === reuse.worktreePath);
  if (!registeredHere || sameHeadElsewhere || !reuse.context.fs.exists(reuse.worktreePath)) {
    return false;
  }
  const currentBranch = await resolveCurrentBranch({
    git: reuse.context.git,
    worktreePath: reuse.worktreePath,
    log: reuse.context.log,
  });
  return currentBranch === reuse.headBranch;
};

const tryReuse = async (reuse: {
  readonly context: AcquireContext;
  readonly worktreePath: string;
  readonly headBranch: string;
}): Promise<boolean> => {
  if (!(await isReusable(reuse))) return false;
  try {
    await reuse.context.git.run({ args: ["clean", "-ffdx"], cwd: reuse.worktreePath });
    await resetAndMark({
      context: reuse.context,
      worktreePath: reuse.worktreePath,
      headBranch: reuse.headBranch,
    });
    return true;
  } catch (reuseFailure) {
    reuse.context.log.warn(
      { worktreePath: reuse.worktreePath, err: reuseFailure },
      "reusing the worktree failed; rebuilding",
    );
    return false;
  }
};

const rebuild = async (rebuilding: {
  readonly context: AcquireContext;
  readonly worktreePath: string;
  readonly headBranch: string;
}): Promise<void> => {
  const removeContext: RemoveContext = {
    git: rebuilding.context.git,
    repoDir: rebuilding.context.repoDir,
    sharedGitDir: rebuilding.context.sharedGitDir,
    fs: rebuilding.context.fs,
    log: rebuilding.context.log,
  };
  await removeWorktree({ context: removeContext, worktreePath: rebuilding.worktreePath });
  try {
    await rebuilding.context.git.run({
      args: ["worktree", "add", rebuilding.worktreePath, rebuilding.headBranch],
      cwd: rebuilding.context.repoDir,
      configOverrides: { "core.hooksPath": "/dev/null" },
    });
    await resetAndMark({
      context: rebuilding.context,
      worktreePath: rebuilding.worktreePath,
      headBranch: rebuilding.headBranch,
    });
  } catch (addFailure) {
    if (rebuilding.context.fs.exists(rebuilding.worktreePath)) {
      rebuilding.context.fs.removeRecursive(rebuilding.worktreePath);
    }
    throw addFailure;
  }
};

export const acquireWorktree = async (acquisition: {
  readonly context: AcquireContext;
  readonly request: AcquireRequest;
}): Promise<string> => {
  const { context, request } = acquisition;
  const worktreePath = worktreePathFor(request.prNumber);
  await fetchBranch({ git: context.git, repoDir: context.repoDir, branch: request.headBranch });
  if (request.baseBranch !== undefined && request.baseBranch !== request.headBranch) {
    await fetchBranch({ git: context.git, repoDir: context.repoDir, branch: request.baseBranch });
  }
  const reused = await tryReuse({ context, worktreePath, headBranch: request.headBranch });
  if (!reused) await rebuild({ context, worktreePath, headBranch: request.headBranch });
  return worktreePath;
};
