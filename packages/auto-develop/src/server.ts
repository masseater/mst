#!/usr/bin/env node
import { once } from "node:events";

import { readEnvVar } from "./config/env.ts";
import { resolveLogDirectory } from "./config/log-directory.ts";
import { resolveRepositoryRoot } from "./config/repository-root.ts";
import { createConsoleLogger } from "./logging/console-logger.ts";
import { createDailyLogFileSink } from "./logging/daily-log-file.ts";
import { createRelayServer } from "./relay/app.ts";
import { createGithubFetchReader, octokitAccessFor } from "./relay/github-fetch-reader.ts";
import { IdTokenRejectionError } from "./relay/id-token-rejection-error.ts";
import { createMemoryCursorStore } from "./relay/memory-cursor-store.ts";
import { createMemoryEventStore } from "./relay/memory-event-store.ts";
import { createMemorySessionStore } from "./relay/memory-session-store.ts";
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
    repository: relayConfig.githubRepository,
    token: githubToken,
    accessFor: octokitAccessFor({ baseUrl: relayConfig.githubApiOrigin, fetchImpl: fetch }),
  }),
  verifyIdToken: () =>
    Promise.reject(new IdTokenRejectionError("no id token verifier is wired into this build")),
  log,
});

relay.server.listen(relayConfig.port, () => {
  log.info({ port: relayConfig.port }, "relay server listening");
});

const nextOccurrenceOf = async (shutdownSignal: NodeJS.Signals): Promise<NodeJS.Signals> => {
  await once(process, shutdownSignal);
  return shutdownSignal;
};

const receivedSignal = await Promise.race([
  nextOccurrenceOf("SIGINT"),
  nextOccurrenceOf("SIGTERM"),
]);
log.info({ signal: receivedSignal }, "shutting down relay server");
await relay.shutdown();
process.exit(0);
