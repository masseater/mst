import { compact, uniq } from "es-toolkit";

export const normalizeAllowedDirs = (dirs: {
  readonly cwd: string;
  readonly repoRoot: string | null;
  readonly sharedGitDir: string | null;
}): readonly string[] => {
  const candidates = [dirs.repoRoot === dirs.cwd ? null : dirs.repoRoot, dirs.sharedGitDir];
  return uniq(compact(candidates));
};
