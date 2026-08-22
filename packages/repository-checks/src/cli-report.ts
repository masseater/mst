import type { CliResult } from "./cli-result.ts";

export const emitCliReport = (
  { exitCode, out, error }: CliResult,
  {
    writeOutput,
    writeError,
    setExitCode,
  }: {
    readonly writeOutput: (text: string) => unknown;
    readonly writeError: (text: string) => unknown;
    readonly setExitCode: (exitCode: number) => void;
  },
): void => {
  if (out !== "") writeOutput(out);
  if (error !== "") writeError(error);
  setExitCode(exitCode);
};
