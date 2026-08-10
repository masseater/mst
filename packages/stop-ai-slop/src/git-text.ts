import { execFile } from "node:child_process";
import { promisify } from "node:util";

type GitCommandExecutor = (
  repositoryRoot: string,
  args: readonly string[],
) => Promise<Readonly<{ stdout: Uint8Array; stderr: Uint8Array }>>;

type GitCommandOptions = Readonly<{
  repositoryRoot: string;
  args: readonly string[];
  execute?: GitCommandExecutor;
}>;

const executeFile = promisify(execFile);

const executeGitCommand: GitCommandExecutor = async (repositoryRoot, args) =>
  executeFile("git", [...args], {
    cwd: repositoryRoot,
    encoding: "buffer",
    maxBuffer: 100 * 1024 * 1024,
  });

export const runGitBuffer = async ({
  repositoryRoot,
  args,
  execute = executeGitCommand,
}: GitCommandOptions): Promise<Uint8Array> => {
  const { stderr, stdout } = await execute(repositoryRoot, args);
  if (stderr.length > 0) {
    throw new Error(
      `Git command wrote to stderr: ${new TextDecoder("utf-8", { fatal: true }).decode(stderr)}`,
    );
  }

  return stdout;
};

export const runGitText = async (options: GitCommandOptions): Promise<string> =>
  new TextDecoder("utf-8", { fatal: true }).decode(await runGitBuffer(options));
