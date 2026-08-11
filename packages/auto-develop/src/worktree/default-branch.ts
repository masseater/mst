import { UNKNOWN_BRANCH_MARKER } from "./protected-branch.ts";

import type { Logger } from "../logging/logger.ts";
import type { GitRunner } from "./git-runner.ts";

export const DEFAULT_BRANCH_FALLBACK = "main";

export const resolveDefaultBranch = async (resolution: {
  readonly git: GitRunner;
  readonly repoDir: string;
  readonly log: Logger;
}): Promise<string | null> => {
  try {
    const { stdout } = await resolution.git.run({
      args: ["symbolic-ref", "refs/remotes/origin/HEAD"],
      cwd: resolution.repoDir,
    });
    const trimmed = stdout.trim();
    if (trimmed === "") return DEFAULT_BRANCH_FALLBACK;
    return trimmed.replace(/^refs\/remotes\/origin\//, "");
  } catch (failure) {
    resolution.log.warn({ err: failure }, "could not resolve the default branch");
    return null;
  }
};

export const resolveCurrentBranch = async (resolution: {
  readonly git: GitRunner;
  readonly worktreePath: string;
  readonly log: Logger;
}): Promise<string | null> => {
  try {
    const { stdout } = await resolution.git.run({
      args: ["symbolic-ref", "--short", "HEAD"],
      cwd: resolution.worktreePath,
    });
    const trimmed = stdout.trim();
    return trimmed === "" ? null : trimmed;
  } catch (failure) {
    if (failure instanceof Error && failure.message.includes("is not a symbolic ref")) {
      return null;
    }
    resolution.log.warn(
      { worktreePath: resolution.worktreePath, err: failure },
      "unexpected failure resolving current branch",
    );
    return UNKNOWN_BRANCH_MARKER;
  }
};
