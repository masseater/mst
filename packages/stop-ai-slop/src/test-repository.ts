import { execFileSync, type ExecFileSyncOptionsWithStringEncoding } from "node:child_process";
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

type GitExecutor = (
  invocation: Readonly<{
    executable: string;
    args: readonly string[];
    options: ExecFileSyncOptionsWithStringEncoding;
  }>,
) => string;

type TestRepositoryDependencies = Readonly<{
  executeGit?: GitExecutor;
  makeTemporaryDirectory?: (prefix: string) => string;
  now?: () => number;
  removeDirectory?: (path: string) => void;
  timeoutMs?: number;
}>;

type OperationAttempt<Value> =
  | Readonly<{ kind: "completed"; value: Value }>
  | Readonly<{ kind: "failed"; failure: unknown }>;

const TEST_REPOSITORY_TIMEOUT_MS = 40_000;

const executeGit: GitExecutor = ({ executable, args, options }) =>
  execFileSync(executable, [...args], options);

const makeTemporaryDirectory = (prefix: string): string => mkdtempSync(prefix);

const removeDirectory = (path: string): void => {
  rmSync(path, { recursive: true, force: true });
};

const currentTime = (): number => performance.now();

const dependenciesFrom = (
  seams: TestRepositoryDependencies,
): Required<TestRepositoryDependencies> => ({
  executeGit: seams.executeGit ?? executeGit,
  makeTemporaryDirectory: seams.makeTemporaryDirectory ?? makeTemporaryDirectory,
  now: seams.now ?? currentTime,
  removeDirectory: seams.removeDirectory ?? removeDirectory,
  timeoutMs: seams.timeoutMs ?? TEST_REPOSITORY_TIMEOUT_MS,
});

const gitEnvironment = (repositoryRoot: string): NodeJS.ProcessEnv => ({
  GIT_AUTHOR_EMAIL: "stop-ai-slop@example.test",
  GIT_AUTHOR_NAME: "Stop AI Slop",
  GIT_COMMITTER_EMAIL: "stop-ai-slop@example.test",
  GIT_COMMITTER_NAME: "Stop AI Slop",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  HOME: repositoryRoot,
  PATH: process.env.PATH,
});

const runGit = ({
  args,
  deadline,
  dependencies,
  repositoryRoot,
}: Readonly<{
  args: readonly string[];
  deadline: number;
  dependencies: Required<TestRepositoryDependencies>;
  repositoryRoot: string;
}>): string => {
  const remainingMs = deadline - dependencies.now();
  if (remainingMs <= 0) {
    throw new Error(`Test repository Git deadline exceeded before git ${args.join(" ")}`);
  }

  return dependencies.executeGit({
    executable: "git",
    args,
    options: {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: gitEnvironment(repositoryRoot),
      killSignal: "SIGKILL",
      timeout: Math.ceil(remainingMs),
    },
  });
};

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

const attemptOperation = <Value>(operation: () => Value): OperationAttempt<Value> => {
  try {
    return { kind: "completed", value: operation() };
  } catch (failure) {
    return { kind: "failed", failure };
  }
};

const attemptAsyncOperation = async <Value>(
  operation: () => Promise<Value>,
): Promise<OperationAttempt<Value>> => {
  try {
    return { kind: "completed", value: await operation() };
  } catch (failure) {
    return { kind: "failed", failure };
  }
};

const completedValue = <Value>({
  cleanup,
  operation,
  repositoryRoot,
}: Readonly<{
  cleanup: OperationAttempt<void>;
  operation: OperationAttempt<Value>;
  repositoryRoot: string;
}>): Value => {
  if (operation.kind === "failed" && cleanup.kind === "failed") {
    throw new AggregateError(
      [operation.failure, cleanup.failure],
      `Test repository operation and cleanup both failed for ${repositoryRoot}`,
    );
  }
  if (operation.kind === "failed") throw operation.failure;
  if (cleanup.kind === "failed") throw cleanup.failure;
  return operation.value;
};

const executeWithCleanup = async <Value>({
  cleanup,
  operation,
  repositoryRoot,
}: Readonly<{
  cleanup: () => void;
  operation: () => Promise<Value>;
  repositoryRoot: string;
}>): Promise<Value> => {
  const operationAttempt = await attemptAsyncOperation(operation);
  const cleanupAttempt = attemptOperation(cleanup);
  return completedValue({ cleanup: cleanupAttempt, operation: operationAttempt, repositoryRoot });
};

const testRepository = ({
  deadline,
  dependencies,
  repositoryRoot,
}: Readonly<{
  deadline: number;
  dependencies: Required<TestRepositoryDependencies>;
  repositoryRoot: string;
}>): TestRepository => {
  const git = (args: readonly string[]): string =>
    runGit({ args, deadline, dependencies, repositoryRoot });
  const commit = (changes: RepositoryChanges): string => {
    writeChanges(repositoryRoot, changes);
    git(["add", "--all"]);
    git(["commit", "--quiet", "--message", "snapshot"]);
    return git(["rev-parse", "HEAD"]).trim();
  };
  return { root: repositoryRoot, git, commit };
};

export const withTestRepository = async <Result>(
  exercise: (repository: TestRepository) => Promise<Result>,
  seams: TestRepositoryDependencies = {},
): Promise<Result> => {
  const dependencies = dependenciesFrom(seams);
  const deadline = dependencies.now() + dependencies.timeoutMs;
  const repositoryRoot = dependencies.makeTemporaryDirectory(join(tmpdir(), "stop-ai-slop-"));
  const repository = testRepository({ deadline, dependencies, repositoryRoot });
  return executeWithCleanup({
    cleanup: () => {
      dependencies.removeDirectory(repositoryRoot);
    },
    operation: async () => {
      repository.git(["init", "--quiet", "--initial-branch=main"]);
      return exercise(repository);
    },
    repositoryRoot,
  });
};
