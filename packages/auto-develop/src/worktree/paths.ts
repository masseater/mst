import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const WORKTREE_ROOT_NAME = "auto-develop-worktree";

export const LAST_USED_MARKER_NAME = ".auto-develop-last-used";

const PR_DIRECTORY_PATTERN = /^pr-([1-9]\d*)$/;

export const resolveRealPath = (candidate: string): string => {
  try {
    return realpathSync(candidate);
  } catch (realpathFailure) {
    void realpathFailure;
    return candidate;
  }
};

const worktreeRoot = (): string => join(resolveRealPath(tmpdir()), WORKTREE_ROOT_NAME);

export const worktreePathFor = (prNumber: number): string => {
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) {
    throw new Error("Invalid PR number for auto-develop worktree");
  }
  return join(worktreeRoot(), `pr-${prNumber}`);
};

const prNumberFromDirectoryName = (directoryName: string): number | null => {
  const matched = PR_DIRECTORY_PATTERN.exec(directoryName);
  const digits = matched?.[1];
  return digits === undefined ? null : Number(digits);
};

export const isManagedWorktreePath = (candidatePath: string): boolean => {
  const resolved = resolveRealPath(candidatePath);
  return (
    resolveRealPath(dirname(resolved)) === worktreeRoot() &&
    prNumberFromDirectoryName(basename(resolved)) !== null
  );
};
