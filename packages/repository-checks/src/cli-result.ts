import { attemptAsync } from "es-toolkit";

import { measureCheck } from "./check-telemetry.ts";

export const EXIT_SUCCESS = 0;

export const EXIT_PROBLEMS_FOUND = 1;

export const EXIT_MISUSE = 2;

export type CliResult = {
  readonly exitCode: number;
  readonly out: string;
  readonly error: string;
};

const safelyRunCli = async (operation: () => Promise<CliResult>): Promise<CliResult> => {
  const [failure, completedRun] = await attemptAsync(operation);
  if (completedRun !== null) return completedRun;
  return {
    exitCode: EXIT_MISUSE,
    out: "",
    error: `${failure instanceof Error ? failure.message : String(failure)}\n`,
  };
};

export const createCliRunner =
  <Arguments extends readonly unknown[]>(
    operation: (...args: Arguments) => Promise<CliResult>,
  ): ((...args: Arguments) => Promise<CliResult>) =>
  (...handed) =>
    measureCheck(() => safelyRunCli(() => operation(...handed)));
