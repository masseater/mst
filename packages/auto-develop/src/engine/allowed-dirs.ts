export const normalizeAllowedDirs = (dirs: {
  readonly cwd: string;
  readonly repoRoot: string | null;
  readonly sharedGitDir: string | null;
}): readonly string[] => {
  const candidates = [dirs.repoRoot === dirs.cwd ? null : dirs.repoRoot, dirs.sharedGitDir];
  const seen = new Set<string>();
  return candidates.flatMap((candidate) => {
    if (candidate === null || candidate === "" || seen.has(candidate)) return [];
    seen.add(candidate);
    return [candidate];
  });
};
