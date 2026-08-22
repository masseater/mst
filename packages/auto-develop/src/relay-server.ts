import { once } from "es-toolkit";

import { readEnvVar } from "./config/env.ts";
import { resolveLogDirectory } from "./config/log-directory.ts";
import { resolveRepositoryRoot } from "./config/repository-root.ts";
import { createConsoleLogger } from "./logging/console-logger.ts";
import {
  productionRelayServerRuntime,
  type RelayProcess,
  type RelayServerRuntime,
} from "./relay-server-runtime.ts";
import { octokitAccessFor } from "./relay/github-fetch-reader.ts";
import { IdTokenRejectionError } from "./relay/id-token-rejection-error.ts";
import { createMemoryCursorStore } from "./relay/memory-cursor-store.ts";
import { createMemoryEventStore } from "./relay/memory-event-store.ts";
import { createMemorySessionStore } from "./relay/memory-session-store.ts";
import { relayConfigFromEnv, type RelayConfig } from "./relay/relay-config.ts";
import { ABORT_SIGNAL_EVENT, SOCKET_LIFECYCLE_EVENT } from "./runtime/event-names.ts";
import { registerShutdown, type ShutdownRegistration } from "./runtime/shutdown.ts";

import type { Logger } from "./logging/logger.ts";
type RunningRelayServer = {
  readonly relay: RelayProcess;
  readonly shutdownRegistration: ShutdownRegistration;
};

type ReleaseLifecycle = {
  readonly add: (release: () => void) => void;
  readonly release: () => void;
};

type ShutdownAndExit = (exitCode: number) => Promise<void>;

const createRelayLogger = (runtime: RelayServerRuntime): Logger =>
  createConsoleLogger("auto-develop-relay", {
    fileSink: runtime.createLogFileSink({
      directory: resolveLogDirectory(
        resolveRepositoryRoot(runtime.currentDirectory()),
        runtime.environment,
      ),
      name: "auto-develop-relay",
      nowIso: runtime.nowIso,
      onFailure: (failure) => {
        runtime.stderr.write(`could not append to the log file: ${String(failure)}\n`);
      },
    }),
    out: runtime.stdout,
  });

const createConfiguredRelay = (
  runtime: RelayServerRuntime,
  log: Logger,
): { readonly config: RelayConfig; readonly relay: RelayProcess } => {
  const config = relayConfigFromEnv(runtime.environment);
  const githubToken =
    readEnvVar("GH_TOKEN", runtime.environment) ?? readEnvVar("GITHUB_TOKEN", runtime.environment);
  if (githubToken === undefined) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN must be set for GitHub API access");
  }
  const relay = runtime.createRelay({
    config,
    events: createMemoryEventStore(),
    cursors: createMemoryCursorStore(),
    sessions: createMemorySessionStore(),
    github: runtime.createGithubReader({
      repository: config.githubRepository,
      token: githubToken,
      accessFor: octokitAccessFor({
        baseUrl: config.githubApiOrigin,
        fetchImpl: runtime.fetchImpl,
      }),
    }),
    verifyIdToken: () =>
      Promise.reject(new IdTokenRejectionError("no id token verifier is wired into this build")),
    log,
  });
  return { config, relay };
};

const createReleaseLifecycle = (): ReleaseLifecycle => {
  const releaseController = new AbortController();
  return {
    add: (release) => {
      releaseController.signal.addEventListener(ABORT_SIGNAL_EVENT.abort, release, { once: true });
    },
    release: once(() => {
      releaseController.abort();
    }),
  };
};

const createShutdownAndExit = (shutdown: {
  readonly lifecycle: ReleaseLifecycle;
  readonly log: Logger;
  readonly relay: RelayProcess;
  readonly runtime: RelayServerRuntime;
}): ShutdownAndExit =>
  once(async (exitCode: number): Promise<void> => {
    shutdown.lifecycle.release();
    try {
      await shutdown.relay.shutdown();
    } catch (failure) {
      shutdown.log.error({ err: failure }, "relay server shutdown failed");
      shutdown.runtime.exit(1);
      return;
    }
    shutdown.runtime.exit(exitCode);
  });

const registerServerFailure = (registration: {
  readonly lifecycle: ReleaseLifecycle;
  readonly log: Logger;
  readonly relay: RelayProcess;
  readonly shutdownAndExit: ShutdownAndExit;
}): void => {
  const onServerError = (failure: Error): void => {
    registration.log.error({ err: failure }, "relay server failed");
    void registration.shutdownAndExit(1);
  };
  registration.relay.server.once(SOCKET_LIFECYCLE_EVENT.failure, onServerError);
  registration.lifecycle.add(() => {
    registration.relay.server.off(SOCKET_LIFECYCLE_EVENT.failure, onServerError);
  });
};

const registerSignalShutdown = (registration: {
  readonly lifecycle: ReleaseLifecycle;
  readonly log: Logger;
  readonly runtime: RelayServerRuntime;
  readonly shutdownAndExit: ShutdownAndExit;
}): void => {
  const signalRegistration = registerShutdown({
    target: registration.runtime.signalTarget,
    onSignal: (signal) => {
      registration.log.info({ signal }, "shutting down relay server");
      void registration.shutdownAndExit(0);
    },
    log: registration.log,
  });
  registration.lifecycle.add(signalRegistration.release);
};

const listenForRelayRequests = (listening: {
  readonly config: RelayConfig;
  readonly lifecycle: ReleaseLifecycle;
  readonly log: Logger;
  readonly relay: RelayProcess;
}): void => {
  try {
    listening.relay.server.listen(listening.config.port, () => {
      listening.log.info({ port: listening.config.port }, "relay server listening");
    });
  } catch (failure) {
    listening.lifecycle.release();
    listening.log.error({ err: failure }, "relay server failed to listen");
    throw failure;
  }
};

const startRelayServer = (runtime: RelayServerRuntime): RunningRelayServer => {
  const log = createRelayLogger(runtime);
  const { config, relay } = createConfiguredRelay(runtime, log);
  const lifecycle = createReleaseLifecycle();
  const shutdownAndExit = createShutdownAndExit({ lifecycle, log, relay, runtime });
  registerServerFailure({ lifecycle, log, relay, shutdownAndExit });
  registerSignalShutdown({ lifecycle, log, runtime, shutdownAndExit });
  listenForRelayRequests({ config, lifecycle, log, relay });
  return { relay, shutdownRegistration: { release: lifecycle.release } };
};

export const runRelayServerModule = (
  main: boolean,
  runtime: RelayServerRuntime = productionRelayServerRuntime(),
): RunningRelayServer | null => (main ? startRelayServer(runtime) : null);
