import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { gitExecutablePath } from "@mst/repository-checks";

type RepositoryChanges = {
  readonly files?: Readonly<Record<string, string>>;
  readonly removed?: readonly string[];
};

export type TestRepository = {
  readonly root: string;
  readonly git: (args: readonly string[]) => string;
  readonly commit: (changes: RepositoryChanges) => string;
};

const runGit = (repositoryRoot: string, handedArgs: readonly string[]): string =>
  execFileSync(gitExecutablePath(process.env.PATH), [...handedArgs], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
      GIT_AUTHOR_NAME: "Stop AI Slop",
      GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
      GIT_COMMITTER_NAME: "Stop AI Slop",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      HOME: repositoryRoot,
      PATH: process.env.PATH,
    },
  });

const writeChanges = (repositoryRoot: string, changes: RepositoryChanges): void => {
  for (const [relativePath, writtenContents] of Object.entries(changes.files ?? {})) {
    const absolutePath = resolve(repositoryRoot, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, writtenContents);
  }

  for (const relativePath of changes.removed ?? []) {
    unlinkSync(resolve(repositoryRoot, relativePath));
  }
};

export const withTestRepository = async <Result>(
  exercise: (repository: TestRepository) => Promise<Result>,
): Promise<Result> => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "stop-ai-slop-"));
  runGit(repositoryRoot, ["init", "--quiet", "--initial-branch=main"]);

  const commit = (changes: RepositoryChanges): string => {
    writeChanges(repositoryRoot, changes);
    runGit(repositoryRoot, ["add", "--all"]);
    runGit(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
    return runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
  };

  try {
    return await exercise({
      root: repositoryRoot,
      git: (handedArgs) => runGit(repositoryRoot, handedArgs),
      commit,
    });
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
};
