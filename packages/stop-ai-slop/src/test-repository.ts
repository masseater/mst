import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

type RepositoryChanges = {
  readonly files?: Readonly<Record<string, string>>;
  readonly removed?: readonly string[];
};

export type TestRepository = {
  readonly root: string;
  readonly git: (args: readonly string[]) => string;
  readonly commit: (changes: RepositoryChanges) => string;
};

const runGit = (repositoryRoot: string, args: readonly string[]): string =>
  execFileSync("git", [...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      HOME: repositoryRoot,
      PATH: process.env.PATH,
    },
  });

const writeChanges = (repositoryRoot: string, changes: RepositoryChanges): void => {
  for (const [relativePath, contents] of Object.entries(changes.files ?? {})) {
    const absolutePath = resolve(repositoryRoot, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
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
  runGit(repositoryRoot, ["config", "user.email", "stop-ai-slop@example.test"]);
  runGit(repositoryRoot, ["config", "user.name", "Stop AI Slop"]);

  const commit = (changes: RepositoryChanges): string => {
    writeChanges(repositoryRoot, changes);
    runGit(repositoryRoot, ["add", "--all"]);
    runGit(repositoryRoot, ["commit", "--quiet", "--message", "snapshot"]);
    return runGit(repositoryRoot, ["rev-parse", "HEAD"]).trim();
  };

  try {
    return await exercise({
      root: repositoryRoot,
      git: (args) => runGit(repositoryRoot, args),
      commit,
    });
  } finally {
    rmSync(repositoryRoot, { recursive: true, force: true });
  }
};
