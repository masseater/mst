export type CommandExecutor = {
  readonly run: (invocation: {
    readonly binary: string;
    readonly args: readonly string[];
  }) => Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }>;
};

export type TailFs = {
  readonly makeTempDir: (prefix: string) => string;
  readonly appendTarget: (path: string) => void;
  readonly readFrom: (target: { readonly path: string; readonly offset: number }) => string;
  readonly readExitCode: (path: string) => number | null;
  readonly readAll: (path: string) => string;
  readonly removeRecursive: (path: string) => void;
};

export const shellQuote = (token: string): string => `'${token.replaceAll("'", "'\\''")}'`;
