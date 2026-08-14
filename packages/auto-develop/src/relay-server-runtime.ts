import { createDailyLogFileSink, type LogFileSink } from "./logging/daily-log-file.ts";
import { createRelayServer } from "./relay/app.ts";
import { createGithubFetchReader } from "./relay/github-fetch-reader.ts";

import type { TextOutput } from "./logging/console-logger.ts";
import type { GithubReader } from "./relay/github-reader.ts";
import type { RelayDependencies } from "./relay/routes.ts";
import type { SignalTarget } from "./runtime/shutdown.ts";

export type RelayProcess = {
  readonly server: {
    readonly listen: (port: number, onListening: () => void) => unknown;
    readonly once: (event: "error", listener: (failure: Error) => void) => unknown;
    readonly off: (event: "error", listener: (failure: Error) => void) => unknown;
  };
  readonly shutdown: () => Promise<void>;
};

export type RelayServerRuntime = {
  readonly environment: Readonly<Record<string, unknown>>;
  readonly currentDirectory: () => string;
  readonly nowIso: () => string;
  readonly fetchImpl: typeof fetch;
  readonly signalTarget: SignalTarget;
  readonly stdout: TextOutput;
  readonly stderr: TextOutput;
  readonly exit: (code: number) => void;
  readonly createGithubReader: (
    access: Parameters<typeof createGithubFetchReader>[0],
  ) => GithubReader;
  readonly createLogFileSink: (sink: {
    readonly directory: string;
    readonly name: string;
    readonly nowIso: () => string;
    readonly onFailure: (failure: unknown) => void;
  }) => LogFileSink;
  readonly createRelay: (dependencies: RelayDependencies) => RelayProcess;
};

export const productionRelayServerRuntime = (): RelayServerRuntime => ({
  environment: process.env,
  currentDirectory: process.cwd.bind(process),
  nowIso: () => new Date().toISOString(),
  fetchImpl: fetch,
  signalTarget: process,
  stdout: process.stdout,
  stderr: process.stderr,
  exit: process.exit.bind(process),
  createGithubReader: createGithubFetchReader,
  createLogFileSink: createDailyLogFileSink,
  createRelay: createRelayServer,
});
