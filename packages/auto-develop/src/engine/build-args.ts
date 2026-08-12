import { normalizeAllowedDirs } from "./allowed-dirs.ts";
import { engineSessionName } from "./session-name.ts";

export const buildClaudeArgs = (build: {
  readonly prompt: string;
  readonly prNumber: number;
  readonly bypassPermissions: boolean;
}): readonly string[] => {
  const sessionName = engineSessionName(build.prNumber);
  if (build.bypassPermissions) {
    return ["-p", "--dangerously-skip-permissions", "--name", sessionName, build.prompt];
  }
  return ["-p", "--permission-mode", "auto", "--name", sessionName, build.prompt];
};

export const buildCodexArgs = (build: {
  readonly prompt: string;
  readonly cwd: string;
  readonly repoRoot: string | null;
  readonly sharedGitDir: string | null;
  readonly bypassPermissions: boolean;
}): readonly string[] => {
  const allowedDirs = normalizeAllowedDirs({
    cwd: build.cwd,
    repoRoot: build.repoRoot,
    sharedGitDir: build.sharedGitDir,
  });
  const addDirArgs = allowedDirs.flatMap((dir) => ["--add-dir", dir]);
  if (build.bypassPermissions) {
    return [
      "-a",
      "never",
      "exec",
      "--dangerously-bypass-approvals-and-sandbox",
      "-C",
      build.cwd,
      ...addDirArgs,
      build.prompt,
    ];
  }
  return [
    "-a",
    "on-request",
    "-c",
    'approvals_reviewer="auto_review"',
    "exec",
    "-C",
    build.cwd,
    ...addDirArgs,
    build.prompt,
  ];
};
