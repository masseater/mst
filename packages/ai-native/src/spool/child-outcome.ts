import { constants } from "node:os";

import { CHILD_PROCESS_EVENT } from "../node-event-names.ts";

import type { ChildProcess } from "node:child_process";

export type ChildEnd = { code: number | null; signal: NodeJS.Signals | null };

export const exitCodeOf = (end: ChildEnd): number => {
  if (end.code !== null) {
    return end.code;
  }
  return 128 + constants.signals[end.signal as NodeJS.Signals];
};

export const waitSpawn = (child: ChildProcess): Promise<Error | undefined> =>
  new Promise((resolvePromise) => {
    child.once(CHILD_PROCESS_EVENT.spawn, () => {
      resolvePromise(undefined);
    });
    child.once(CHILD_PROCESS_EVENT.failure, (spawnError) => {
      resolvePromise(spawnError);
    });
  });

export const waitClose = (child: ChildProcess): Promise<ChildEnd> =>
  new Promise((resolvePromise) => {
    child.once(CHILD_PROCESS_EVENT.close, (code, signal) => {
      resolvePromise({ code, signal });
    });
  });

export const startFailureSummary = (commandLine: string, spawnError: Error): string =>
  `spool: command: ${commandLine}\nspool: error: cannot start command: ${String(spawnError)}\n`;
