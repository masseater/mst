import { parseAuthSession } from "../contract/auth-session.ts";
import { AUTH_SESSION_PATH, EVENT_STREAM_PATH } from "../contract/endpoints.ts";
import { createEngine } from "../engine/engine.ts";
import { runInTmux } from "../engine/tmux-runner.ts";
import { createLifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import { createConsoleLogger } from "../logging/console-logger.ts";
import { createDailyLogFileSink } from "../logging/daily-log-file.ts";
import { createJobQueue } from "../queue/job-queue.ts";
import { createSseTransport } from "../transport/sse-transport.ts";
import { acquireWorktree } from "../worktree/acquire-worktree.ts";
import { resolveDefaultBranch } from "../worktree/default-branch.ts";
import { createGitOperations } from "../worktree/git-operations.ts";
import { syncMain } from "../worktree/main-sync.ts";
import { createSerialGate } from "../worktree/serial-gate.ts";
import { remoteBranchPresentIn, shouldReclaim } from "../worktree/staleness.ts";
import { createWorktreeFs } from "../worktree/worktree-fs.ts";
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

const issueRelaySession = async (issue: {
  readonly relayOrigin: string;
  readonly githubToken: string;
}): Promise<{ readonly token: string; readonly expiresAt: string }> => {
  const response = await fetch(`${issue.relayOrigin}${AUTH_SESSION_PATH}`, {
    method: "POST",
    headers: { authorization: `Bearer ${issue.githubToken}` },
  });
  if (!response.ok) throw new Error(`the relay refused the session with status ${response.status}`);
  return parseAuthSession(await response.json());
};

const probeRemoteHead = async (probe: {
  readonly git: GitRunner;
  readonly repoDir: string;
  readonly log: Logger;
}): Promise<string | null> => {
  const branch = await resolveDefaultBranch(probe);
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

export const composeRuntime = (wiring: RuntimeWiring): ComposedRuntime => {
  const log = createConsoleLogger(`auto-develop-${wiring.mode}`, {
    fileSink: createDailyLogFileSink({
      directory: wiring.logDirectory,
      name: `auto-develop-${wiring.mode}`,
      nowIso: () => new Date().toISOString(),
      onFailure: (failure) => {
        process.stderr.write(`could not append to the log file: ${String(failure)}\n`);
      },
    }),
  });
  const git = createGitRunner();
  const exec = createCommandExecutor();
  const gate = createLifecycleGate();
  const queue = createJobQueue({ concurrency: wiring.concurrency, prFilter: wiring.prFilter, log });
  const credentials = createRelayCredentialProvider({
    allowedOrigin: wiring.relayOrigin,
    issueSession: () =>
      issueRelaySession({ relayOrigin: wiring.relayOrigin, githubToken: wiring.githubToken }),
    resolveGithubToken: () => Promise.resolve(wiring.githubToken),
    now: () => Date.now(),
    log,
  });
  const engine = createEngine({
    kind: wiring.engineKind,
    ...(wiring.engineOverride === undefined ? {} : { launchOverride: wiring.engineOverride }),
    resolveGitPaths: async (cwd) => {
      const operations = createGitOperations({ git, cwd });
      const [repoRoot, sharedGitDir] = await Promise.all([
        operations.topLevelPath(),
        operations.sharedGitDirPath(),
      ]);
      return { repoRoot, sharedGitDir };
    },
    timeoutMs: wiring.engineTimeoutMs,
    bypassPermissions: wiring.bypassPermissions,
    runner: runInTmux({
      exec,
      fs: createTailFs(),
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      log,
    }),
    killSession: async (sessionName) => {
      await exec.run({ binary: "tmux", args: ["kill-session", "-t", sessionName] });
    },
    log,
  });
  const transport = createSseTransport({
    url: `${wiring.relayOrigin}${EVENT_STREAM_PATH}`,
    credentials,
    mode: wiring.mode,
  });
  return {
    log,
    syncToMain: () => syncMain({ git, startDir: wiring.repoDir, log }),
    drainStartup: () =>
      runStartupDrainClient({
        baseUrl: wiring.relayOrigin,
        mode: wiring.mode,
        credentials,
        fetchImpl: fetch,
        log,
      }),
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
      acquireWorktree,
      acquireContext: {
        git,
        repoDir: wiring.repoDir,
        sharedGitDir: `${wiring.repoDir}/.git`,
        fs: createWorktreeFs(),
        log,
        now: () => new Date(),
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
    remoteHeadCommit: () => probeRemoteHead({ git, repoDir: wiring.repoDir, log }),
    killEngine: (prNumber) => engine.kill(prNumber),
    worktreeIsStale: async (check) => {
      const listed = await git.run({
        args: ["ls-remote", "--heads", "origin", `refs/heads/${check.branch}`],
        cwd: wiring.repoDir,
      });
      return shouldReclaim({
        remoteBranchExists: remoteBranchPresentIn(listed.stdout, check.branch),
        lastUsedMtimeMs: createWorktreeFs().markerMtimeMs(check.worktreePath),
        nowMs: Date.now(),
      });
    },
  };
};
