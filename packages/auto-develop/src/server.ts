#!/usr/bin/env node
import { readEnvVar } from "./config/env.ts";
import { resolveLogDirectory } from "./config/log-directory.ts";
import { resolveRepositoryRoot } from "./config/repository-root.ts";
import { createConsoleLogger } from "./logging/console-logger.ts";
import { createDailyLogFileSink } from "./logging/daily-log-file.ts";
import { createRelayServer } from "./relay/app.ts";
import { createGithubFetchReader } from "./relay/github-fetch-reader.ts";
import { IdTokenRejectionError } from "./relay/id-token-rejection-error.ts";
import {
  createMemoryCursorStore,
  createMemoryEventStore,
  createMemorySessionStore,
} from "./relay/memory-store.ts";
import { relayConfigFromEnv } from "./relay/relay-config.ts";

const log = createConsoleLogger("auto-develop-relay", {
  fileSink: createDailyLogFileSink({
    directory: resolveLogDirectory(resolveRepositoryRoot(process.cwd())),
    name: "auto-develop-relay",
    nowIso: () => new Date().toISOString(),
    onFailure: (failure) => {
      process.stderr.write(`could not append to the log file: ${String(failure)}\n`);
    },
  }),
});
const relayConfig = relayConfigFromEnv();
const githubToken = readEnvVar("GH_TOKEN") ?? readEnvVar("GITHUB_TOKEN");
if (githubToken === undefined) {
  throw new Error("GH_TOKEN or GITHUB_TOKEN must be set for GitHub API access");
}

const relay = createRelayServer({
  config: relayConfig,
  events: createMemoryEventStore(),
  cursors: createMemoryCursorStore(),
  sessions: createMemorySessionStore(),
  github: createGithubFetchReader({
    apiOrigin: relayConfig.githubApiOrigin,
    repository: relayConfig.githubRepository,
    token: githubToken,
  }),
  verifyIdToken: () =>
    Promise.reject(new IdTokenRejectionError("no id token verifier is wired into this build")),
  log,
});

const shutdownAndExit = async (signalName: string): Promise<void> => {
  log.info({ signal: signalName }, "shutting down relay server");
  await relay.shutdown();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdownAndExit("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdownAndExit("SIGTERM");
});

relay.server.listen(relayConfig.port, () => {
  log.info({ port: relayConfig.port }, "relay server listening");
});
