import { spawn } from "node:child_process";

import {
  exitCodeOf,
  startFailureSummary,
  waitClose,
  waitSpawn,
  type ChildEnd,
} from "./child-outcome.ts";
import { formatElapsed } from "./format-elapsed.ts";

import type { Writable } from "node:stream";
import type { Command } from "./parse-command.ts";

export type PassthroughDeps = {
  stdout: Writable;
  stderr: Writable;
  monotonicNow: () => number;
};

export const isPassthroughSignalled = (ciSignal: string | undefined): boolean =>
  ciSignal !== undefined && ciSignal !== "" && ciSignal !== "false";

const reportStartFailure = async (input: {
  deps: PassthroughDeps;
  commandLine: string;
  closed: Promise<ChildEnd>;
  spawnError: Error;
}): Promise<number> => {
  await input.closed;
  input.deps.stderr.write(startFailureSummary(input.commandLine, input.spawnError));
  return 127;
};

export const runPassthrough = async (command: Command, deps: PassthroughDeps): Promise<number> => {
  const commandLine = command.join(" ");
  const startedAt = deps.monotonicNow();
  const child = spawn(command[0], command.slice(1), { stdio: "inherit" });
  const closed = waitClose(child);
  const spawnError = await waitSpawn(child);
  if (spawnError !== undefined) {
    return reportStartFailure({ deps, commandLine, closed, spawnError });
  }
  const exitCode = exitCodeOf(await closed);
  deps.stdout.write(
    `spool: command: ${commandLine}\nspool: exit: ${exitCode} (${formatElapsed(deps.monotonicNow() - startedAt)})\n`,
  );
  return exitCode;
};
