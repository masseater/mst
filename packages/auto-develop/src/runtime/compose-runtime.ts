import { parseAuthSession } from "../contract/auth-session.ts";
import { AUTH_SESSION_PATH, EVENT_STREAM_PATH } from "../contract/endpoints.ts";
import { createEngine } from "../engine/engine.ts";
import { runInTmux } from "../engine/tmux-runner.ts";
import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { createConsoleLogger } from "../logging/console-logger.ts";
import { createDailyLogFileSink, type LogFileSink } from "../logging/daily-log-file.ts";
import { createJobQueue, type JobQueue, type JobQueueConfig } from "../queue/job-queue.ts";
import {
  createSseTransport,
  type SseTransport,
  type SseTransportConfig,
} from "../transport/sse-transport.ts";
import { acquireWorktree } from "../worktree/acquire-worktree.ts";
import { resolveDefaultBranch } from "../worktree/default-branch.ts";
import { createGitOperations } from "../worktree/git-operations.ts";
import { syncMain } from "../worktree/main-sync.ts";
import { createSerialGate } from "../worktree/serial-gate.ts";
import { remoteBranchPresentIn, shouldReclaim } from "../worktree/staleness.ts";
import { createWorktreeFs, type WorktreeFs } from "../worktree/worktree-fs.ts";
import { createEventDispatcher } from "./event-dispatch.ts";
import { createCommandExecutor, createGitRunner, createTailFs } from "./node-adapters.ts";
import { createRelayCredentialProvider } from "./relay-credential.ts";
import { createSessionOrchestrator } from "./session-orchestrator.ts";
import { runStartupDrainClient } from "./startup-drain-client.ts";

import type { EngineKind } from "../config/engine.ts";
import type { Mode } from "../contract/vocabulary.ts";
import type { Logger } from "../logging/logger.ts";
import type { PrFilter } from "../queue/pr-lane.ts";
import type { GitRunner } from "../worktree/git-runner.ts";

export type RuntimeWiring = {
  readonly mode: Mode;
  readonly relayOrigin: string;
  readonly repoDir: string;
  readonly logDirectory: string;
  readonly engineKind: EngineKind;
  readonly engineOverride?: string;
  readonly engineTimeoutMs: number;
  readonly bypassPermissions: boolean;
  readonly concurrency: number;
  readonly prFilter: PrFilter;
  readonly githubToken: string;
  readonly setupWorktree: (worktreePath: string) => Promise<void>;
};

export type ComposedRuntime = {
  readonly log: Logger;
  readonly syncToMain: () => Promise<void>;
  readonly drainStartup: () => Promise<readonly Readonly<Record<string, unknown>>[]>;
  readonly connect: () => Promise<void>;
  readonly subscribe: () => AsyncGenerator<Readonly<Record<string, unknown>>, void, undefined>;
  readonly dispatcher: ReturnType<typeof createEventDispatcher>;
  readonly queue: ReturnType<typeof createJobQueue>;
  readonly gate: ReturnType<typeof createLifecycleGate>;
  readonly orchestrator: ReturnType<typeof createSessionOrchestrator>;
  readonly disconnect: () => void;
  readonly remoteHeadCommit: () => Promise<string | null>;
  readonly killEngine: (prNumber: number) => Promise<void>;
  readonly worktreeIsStale: (check: {
    readonly worktreePath: string;
    readonly branch: string;
  }) => Promise<boolean>;
};

type ComposeRuntimeDependencies = {
  readonly fetch: typeof fetch;
  readonly createLogFileSink: (sink: {
    readonly directory: string;
    readonly name: string;
    readonly nowIso: () => string;
    readonly onFailure: (failure: unknown) => void;
  }) => LogFileSink;
  readonly createLogger: (
    spelled: string,
    ruleOptions: { readonly fileSink: LogFileSink },
  ) => Logger;
  readonly createGit: () => GitRunner;
  readonly createCommandExecutor: typeof createCommandExecutor;
  readonly createTailFs: typeof createTailFs;
  readonly runInTmux: typeof runInTmux;
  readonly createQueue: (queueConfig: JobQueueConfig) => JobQueue;
  readonly createTransport: (transportConfig: SseTransportConfig) => SseTransport;
  readonly acquireWorktree: typeof acquireWorktree;
  readonly createWorktreeFs: () => WorktreeFs;
  readonly syncMain: typeof syncMain;
  readonly resolveDefaultBranch: typeof resolveDefaultBranch;
  readonly createGitOperations: typeof createGitOperations;
  readonly runStartupDrain: typeof runStartupDrainClient;
  readonly now: () => number;
  readonly nowDate: () => Date;
  readonly sleep: (milliseconds: number) => Promise<void>;
};

const defaultDependencies: ComposeRuntimeDependencies = {
  fetch,
  createLogFileSink: createDailyLogFileSink,
  createLogger: createConsoleLogger,
  createGit: createGitRunner,
  createCommandExecutor,
  createTailFs,
  runInTmux,
  createQueue: createJobQueue,
  createTransport: createSseTransport,
  acquireWorktree,
  createWorktreeFs,
  syncMain,
  resolveDefaultBranch,
  createGitOperations,
  runStartupDrain: runStartupDrainClient,
  now: Date.now,
  nowDate: () => new Date(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

const issueRelaySession = async (issue: {
  readonly relayOrigin: string;
  readonly githubToken: string;
  readonly fetch: ComposeRuntimeDependencies["fetch"];
}): Promise<{ readonly token: string; readonly expiresAt: string }> => {
  const produced = await issue.fetch(`${issue.relayOrigin}${AUTH_SESSION_PATH}`, {
    method: "POST",
    headers: { authorization: `Bearer ${issue.githubToken}` },
  });
  if (!produced.ok) throw new Error(`the relay refused the session with status ${produced.status}`);
  return parseAuthSession(await produced.json());
};

const probeRemoteHead = async (probe: {
  readonly git: GitRunner;
  readonly repoDir: string;
  readonly log: Logger;
  readonly resolveDefaultBranch: ComposeRuntimeDependencies["resolveDefaultBranch"];
}): Promise<string | null> => {
  const branch = await probe.resolveDefaultBranch(probe);
  if (branch === null) return null;
  try {
    await probe.git.run({ args: ["fetch", "origin", branch], cwd: probe.repoDir });
    const revision = await probe.git.run({
      args: ["rev-parse", `origin/${branch}`],
      cwd: probe.repoDir,
    });
    return revision.stdout.trim();
  } catch (probeFailure) {
    probe.log.error(
      { repoDir: probe.repoDir, remote: "origin", ref: `origin/${branch}`, err: probeFailure },
      "could not probe the remote head",
    );
    return null;
  }
};

export const composeRuntime = (
  wiring: RuntimeWiring,
  dependencyOverrides: Partial<ComposeRuntimeDependencies> = {},
): ComposedRuntime => {
  const dependencies: ComposeRuntimeDependencies = {
    ...defaultDependencies,
    ...dependencyOverrides,
  };
  const log = dependencies.createLogger(`auto-develop-${wiring.mode}`, {
    fileSink: dependencies.createLogFileSink({
      directory: wiring.logDirectory,
      name: `auto-develop-${wiring.mode}`,
      nowIso: () => dependencies.nowDate().toISOString(),
      onFailure: (failure) => {
        process.stderr.write(`could not append to the log file: ${String(failure)}\n`);
      },
    }),
  });
  const git = dependencies.createGit();
  const exec = dependencies.createCommandExecutor();
  const gate = createLifecycleGate();
  const queue = dependencies.createQueue({
    concurrency: wiring.concurrency,
    prFilter: wiring.prFilter,
    log,
  });
  const credentials = createRelayCredentialProvider({
    allowedOrigin: wiring.relayOrigin,
    issueSession: () =>
      issueRelaySession({
        relayOrigin: wiring.relayOrigin,
        githubToken: wiring.githubToken,
        fetch: dependencies.fetch,
      }),
    resolveGithubToken: () => Promise.resolve(wiring.githubToken),
    now: dependencies.now,
    log,
  });
  const engine = createEngine({
    kind: wiring.engineKind,
    ...(wiring.engineOverride === undefined ? {} : { launchOverride: wiring.engineOverride }),
    resolveGitPaths: async (cwd) => {
      const operations = dependencies.createGitOperations({ git, cwd });
      const [repoRoot, sharedGitDir] = await Promise.all([
        operations.topLevelPath(),
        operations.sharedGitDirPath(),
      ]);
      return { repoRoot, sharedGitDir };
    },
    timeoutMs: wiring.engineTimeoutMs,
    bypassPermissions: wiring.bypassPermissions,
    runner: dependencies.runInTmux({
      exec,
      fs: dependencies.createTailFs(),
      now: dependencies.now,
      sleep: dependencies.sleep,
      log,
    }),
    killSession: async (sessionName) => {
      await exec.run({ binary: "tmux", args: ["kill-session", "-t", sessionName] });
    },
    log,
  });
  const transport = dependencies.createTransport({
    url: `${wiring.relayOrigin}${EVENT_STREAM_PATH}`,
    credentials,
    mode: wiring.mode,
    fetchImpl: dependencies.fetch,
  });
  return {
    log,
    syncToMain: () => dependencies.syncMain({ git, startDir: wiring.repoDir, log }),
    drainStartup: () =>
      dependencies.runStartupDrain({
        baseUrl: wiring.relayOrigin,
        mode: wiring.mode,
        credentials,
        fetchImpl: dependencies.fetch,
        log,
      }),
    connect: () => transport.connect(),
    subscribe: () => transport.events(),
    dispatcher: createEventDispatcher({
      queue,
      onPrClosed: (prNumber) => {
        gate.close(prNumber);
      },
      onExcluded: (prNumber) => {
        gate.excludeSession(prNumber);
      },
      log,
    }),
    queue,
    gate,
    orchestrator: createSessionOrchestrator({
      acquireWorktree: dependencies.acquireWorktree,
      acquireContext: {
        git,
        repoDir: wiring.repoDir,
        sharedGitDir: `${wiring.repoDir}/.git`,
        fs: dependencies.createWorktreeFs(),
        log,
        now: dependencies.nowDate,
      },
      setupWorktree: wiring.setupWorktree,
      engine,
      gate,
      serialize: createSerialGate().run,
      log,
    }),
    disconnect: () => {
      transport.disconnect();
    },
    remoteHeadCommit: () =>
      probeRemoteHead({
        git,
        repoDir: wiring.repoDir,
        log,
        resolveDefaultBranch: dependencies.resolveDefaultBranch,
      }),
    killEngine: (prNumber) => engine.kill(prNumber),
    worktreeIsStale: async (check) => {
      const listed = await git.run({
        args: ["ls-remote", "--heads", "origin", `refs/heads/${check.branch}`],
        cwd: wiring.repoDir,
      });
      return shouldReclaim({
        remoteBranchExists: remoteBranchPresentIn(listed.stdout, check.branch),
        lastUsedMtimeMs: dependencies.createWorktreeFs().markerMtimeMs(check.worktreePath),
        nowMs: dependencies.now(),
      });
    },
  };
};
