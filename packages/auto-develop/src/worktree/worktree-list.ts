import type { GitRunner } from "./git-runner.ts";

export type RegisteredWorktree = {
  readonly path: string;
  readonly branch: string | null;
};

export const parseWorktreeList = (porcelain: string): readonly RegisteredWorktree[] => {
  const blocks = porcelain.split("\n\n").filter((block) => block.trim() !== "");
  return blocks.flatMap((block) => {
    const lines = block.split("\n");
    const pathLine = lines.find((line) => line.startsWith("worktree "));
    if (pathLine === undefined) return [];
    const branchLine = lines.find((line) => line.startsWith("branch "));
    const branch =
      branchLine === undefined
        ? null
        : branchLine.slice("branch ".length).replace(/^refs\/heads\//, "");
    return [{ path: pathLine.slice("worktree ".length), branch }];
  });
};

export const listRegisteredWorktrees = async (listing: {
  readonly git: GitRunner;
  readonly repoDir: string;
}): Promise<readonly RegisteredWorktree[]> => {
  const { stdout } = await listing.git.run({
    args: ["worktree", "list", "--porcelain"],
    cwd: listing.repoDir,
  });
  return parseWorktreeList(stdout);
};
