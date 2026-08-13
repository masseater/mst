export type GitRunner = {
  readonly run: (invocation: {
    readonly args: readonly string[];
    readonly cwd: string;
    readonly configOverrides?: Readonly<Record<string, string>>;
  }) => Promise<{ readonly stdout: string; readonly stderr: string }>;
};

const DETACHED_HEAD_MARKER = "is not a symbolic ref";

const NOT_A_WORKING_TREE_MARKER = "is not a working tree";

const carriesStderr = (failure: unknown): failure is { readonly stderr: string } =>
  typeof failure === "object" &&
  failure !== null &&
  "stderr" in failure &&
  typeof failure.stderr === "string";

const gitFailureText = (failure: unknown): string => {
  if (!(failure instanceof Error)) return "";
  return `${carriesStderr(failure) ? failure.stderr : ""}\n${failure.message}`;
};

export const indicatesDetachedHead = (failure: unknown): boolean =>
  gitFailureText(failure).includes(DETACHED_HEAD_MARKER);

export const indicatesNotAWorkingTree = (failure: unknown): boolean =>
  gitFailureText(failure).includes(NOT_A_WORKING_TREE_MARKER);
