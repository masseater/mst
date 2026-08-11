export type GitCommandResult = {
  readonly stdout: string;
  readonly stderr: string;
};

export type GitRunner = {
  readonly run: (invocation: {
    readonly args: readonly string[];
    readonly cwd: string;
    readonly configOverrides?: Readonly<Record<string, string>>;
  }) => Promise<GitCommandResult>;
};

const DETACHED_HEAD_MARKER = "is not a symbolic ref";

const NOT_A_WORKING_TREE_MARKER = "is not a working tree";

const gitFailureText = (failure: unknown): string => {
  if (!(failure instanceof Error)) return "";
  const stderr = Object.hasOwn(failure, "stderr") ? (failure as { stderr?: unknown }).stderr : "";
  return `${typeof stderr === "string" ? stderr : ""}\n${failure.message}`;
};

export const indicatesDetachedHead = (failure: unknown): boolean =>
  gitFailureText(failure).includes(DETACHED_HEAD_MARKER);

export const indicatesNotAWorkingTree = (failure: unknown): boolean =>
  gitFailureText(failure).includes(NOT_A_WORKING_TREE_MARKER);
