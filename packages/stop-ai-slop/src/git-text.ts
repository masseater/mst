import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { gitExecutablePath } from "@mst/repository-checks";
import { omitBy } from "es-toolkit";

type GitCommandExecutor = (
  repositoryRoot: string,
  args: readonly string[],
) => Promise<Readonly<{ stdout: Uint8Array; stderr: Uint8Array }>>;

type GitCommandOptions = Readonly<{
  repositoryRoot: string;
  args: readonly string[];
  execute?: GitCommandExecutor;
}>;

const environmentOutsideAnyRepository = (): Readonly<Record<string, string | undefined>> =>
  omitBy(process.env, (_, spelled) => String(spelled).startsWith("GIT_"));

const executeFile = promisify(execFile);

const executeGitCommand: GitCommandExecutor = async (repositoryRoot, handedArgs) => {
  const repositoryAgnosticEnv = environmentOutsideAnyRepository();
  return executeFile(gitExecutablePath(repositoryAgnosticEnv.PATH), [...handedArgs], {
    cwd: repositoryRoot,
    encoding: "buffer",
    env: repositoryAgnosticEnv,
    maxBuffer: 100 * 1024 * 1024,
  });
};

export const runGitBuffer = async ({
  repositoryRoot,
  args: handedArgs,
  execute = executeGitCommand,
}: GitCommandOptions): Promise<Uint8Array> => {
  const { stderr, stdout } = await execute(repositoryRoot, handedArgs);
  if (stderr.length > 0) {
    throw new Error(
      `Git command wrote to stderr: ${new TextDecoder("utf-8", { fatal: true }).decode(stderr)}`,
    );
  }

  return stdout;
};

export const runGitText = async (ruleOptions: GitCommandOptions): Promise<string> =>
  new TextDecoder("utf-8", { fatal: true }).decode(await runGitBuffer(ruleOptions));
