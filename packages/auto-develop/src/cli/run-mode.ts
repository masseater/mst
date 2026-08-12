import { DEFAULT_ENGINE } from "../config/engine.ts";
import { readEnvVar } from "../config/env.ts";
import { resolveLogDirectory } from "../config/log-directory.ts";
import { resolveRepositoryRoot } from "../config/repository-root.ts";
import { prepareRunContext } from "../context/prepare-run-context.ts";
import { buildPrompt } from "../context/prompt.ts";
import { LAUNCH_AUTO } from "../context/run-context.ts";
import { asRecord } from "../contract/unknown-record.ts";
import { createAuthorHandler } from "../handlers/author-handler.ts";
import { createGithubApiClient } from "../handlers/github-api-client.ts";
import { createReviewInputCoordinator } from "../handlers/review-input-coordinator.ts";
import { createReviewerHandler } from "../handlers/reviewer-handler.ts";
import { withJobBanner } from "../queue/job-banner.ts";
import { prLaneNumber, type PrFilter } from "../queue/pr-lane.ts";
import { createPeriodicScheduler } from "../queue/scheduler.ts";
import { composeRuntime, type ComposedRuntime } from "../runtime/compose-runtime.ts";
import { createIdleMonitor, type IdleMonitor } from "../runtime/idle-monitor.ts";
import {
  codeMovedOn,
  createRestartRequest,
  type RestartRequest,
} from "../runtime/restart-request.ts";
import { buildRunMetadata, runMetadataLogFields } from "../runtime/run-metadata.ts";
import { renderStatusBar } from "../runtime/status-bar.ts";
import { worktreePathFor } from "../worktree/paths.ts";
import { cycleUntilStopped } from "./cycle-loop.ts";
import { runContextFsOnDisk } from "./run-context-fs.ts";

import type { Mode } from "../contract/vocabulary.ts";
import type { HandlerGithubClient } from "../handlers/github-client.ts";

const UPDATE_CHECK_INTERVAL_MS = 15 * 60_000;

const IDLE_RESTART_THRESHOLD_MS = 30 * 60_000;

export type ModeRunRequest = {
  readonly mode: Mode;
  readonly relayOrigin: string;
  readonly repository: string;
  readonly githubToken: string;
  readonly concurrency: number;
  readonly prFilter: PrFilter;
  readonly dryRun: boolean;
  readonly reviewerLogin: string;
  readonly bypassPermissions: boolean;
  readonly engineTimeoutMs: number;
};

const promptFor = (build: {
  readonly mode: Mode;
  readonly prNumber: number;
  readonly baseRef: string;
  readonly headRef: string;
  readonly worktreePath: string;
  readonly reason?: string;
}): string => {
  const runContext = prepareRunContext({
    request: {
      worktreePath: build.worktreePath,
      mode: build.mode,
      launchPath: LAUNCH_AUTO,
      prNumber: build.prNumber,
      baseRef: build.baseRef,
      headRef: build.headRef,
      prContextJsonPath: `${build.worktreePath}/.repo-workflow/review-context/context.json`,
      prContextMarkdownPath: `${build.worktreePath}/.repo-workflow/review-context/context.md`,
      failedCiLogsDir: `${build.worktreePath}/.repo-workflow/review-context/ci-logs`,
    },
    fs: runContextFsOnDisk,
    nowIso: () => new Date().toISOString(),
  });
  return buildPrompt({
    engine: DEFAULT_ENGINE,
    mode: build.mode,
    prNumber: build.prNumber,
    baseRef: build.baseRef,
    headRef: build.headRef,
    runContextJsonPath: runContext.workflow.inventoryJsonPath,
    ...(build.reason === undefined ? {} : { reason: build.reason }),
  });
};

const runtimeFor = (request: ModeRunRequest): ComposedRuntime => {
  const repoDir = resolveRepositoryRoot(process.cwd());
  const engineCommand = readEnvVar("AUTO_DEVELOP_ENGINE_COMMAND");
  return composeRuntime({
    mode: request.mode,
    relayOrigin: request.relayOrigin,
    repoDir,
    logDirectory: resolveLogDirectory(repoDir),
    engineKind: DEFAULT_ENGINE,
    ...(engineCommand === undefined ? {} : { engineOverride: engineCommand }),
    engineTimeoutMs: request.engineTimeoutMs,
    bypassPermissions: request.bypassPermissions,
    concurrency: request.concurrency,
    prFilter: request.prFilter,
    githubToken: request.githubToken,
    setupWorktree: () => Promise.resolve(),
  });
};

const pullNumberOf = (payload: unknown): number => {
  const pullNumber = asRecord(payload)?.pullNumber;
  return typeof pullNumber === "number" ? pullNumber : 0;
};

const attachHandlers = (attaching: {
  readonly request: ModeRunRequest;
  readonly runtime: ComposedRuntime;
  readonly github: HandlerGithubClient;
}): void => {
  const { request, runtime, github } = attaching;
  const coordinate = createReviewInputCoordinator({
    gate: runtime.gate,
    queue: runtime.queue,
    stopSession: (prNumber) => runtime.killEngine(prNumber),
    jobType: "review-input-changed",
    log: runtime.log,
  });
  const reviewer = createReviewerHandler({
    github,
    gate: runtime.gate,
    runSession: (session) =>
      runtime.orchestrator.runInWorktree({
        prNumber: session.prNumber,
        headBranch: session.headBranch,
        baseBranch: session.baseBranch,
        buildPrompt: (worktreePath) =>
          Promise.resolve(
            promptFor({
              mode: request.mode,
              prNumber: session.prNumber,
              baseRef: `origin/${session.baseBranch}`,
              headRef: session.headBranch,
              worktreePath,
            }),
          ),
      }),
    requestFollowUpReview: (followUp) => {
      void coordinate({ prNumber: followUp.prNumber, endpoint: followUp.endpoint });
    },
    dryRun: request.dryRun,
    proxyLogin: request.reviewerLogin,
    log: runtime.log,
  });
  const author = createAuthorHandler({
    github,
    runSession: (session) =>
      runtime.orchestrator.runInWorktree({
        prNumber: session.prNumber,
        headBranch: session.headBranch,
        buildPrompt: (worktreePath) =>
          Promise.resolve(
            promptFor({
              mode: request.mode,
              prNumber: session.prNumber,
              baseRef: session.headBranch,
              headRef: session.headBranch,
              worktreePath,
              reason: session.reason,
            }),
          ),
      }),
    reviewerLogin: request.reviewerLogin,
    dryRun: request.dryRun,
    log: runtime.log,
  });
  runtime.queue.setHandlers({
    handlers: {
      "pr-event": (payload) => {
        const prNumber = pullNumberOf(payload);
        return withJobBanner({
          mode: request.mode,
          prNumber,
          run: async () => {
            if (request.mode === "reviewer") {
              await reviewer(prNumber);
              return;
            }
            await author({ prNumber, reason: "request_changes" });
          },
        });
      },
    },
  });
};

const paintStatusBar = (painting: {
  readonly request: ModeRunRequest;
  readonly runtime: ComposedRuntime;
  readonly startedAtMs: number;
}): void => {
  const lines = renderStatusBar({
    snapshot: {
      mode: painting.request.mode,
      engineCommand: DEFAULT_ENGINE,
      connected: true,
      runningLanes: painting.runtime.queue.runningLanes(),
      waitingLanes: painting.runtime.queue.waitingLanes(),
      uptimeMs: Date.now() - painting.startedAtMs,
    },
    width: process.stdout.columns,
  });
  for (const line of lines) painting.runtime.log.info({ statusBar: true }, line);
};

const announceStart = (announcing: {
  readonly request: ModeRunRequest;
  readonly runtime: ComposedRuntime;
}): void => {
  const { request } = announcing;
  announcing.runtime.log.info(
    runMetadataLogFields(
      buildRunMetadata({
        mode: request.mode,
        engine: DEFAULT_ENGINE,
        ghUser: request.reviewerLogin,
        ghUserSource: "override",
        ghTokenSource: "environment-variable",
        concurrency: request.concurrency,
        dryRun: request.dryRun,
        dangerouslySkipPermissions: request.bypassPermissions,
        targetPrs: request.prFilter.targetPrs,
        excludedPrs: request.prFilter.excludedPrs,
      }),
    ),
    "runtime starting",
  );
};

const reclaimIdleWorktrees = async (reclaiming: {
  readonly runtime: ComposedRuntime;
}): Promise<void> => {
  const { runtime } = reclaiming;
  for (const lane of runtime.queue.waitingLanes()) {
    const prNumber = prLaneNumber(lane);
    if (prNumber === null) continue;
    const worktreePath = worktreePathFor(prNumber);
    const stale = await runtime.worktreeIsStale({ worktreePath, branch: lane });
    if (stale) runtime.log.info({ worktreePath }, "worktree is idle and can be reclaimed");
  }
};

const requestRestartWhenCodeMovedOn = async (checking: {
  readonly baseline: Map<string, string>;
  readonly runtime: ComposedRuntime;
  readonly restart: RestartRequest;
}): Promise<void> => {
  const startupCommit = checking.baseline.get("commit");
  if (startupCommit === undefined) return;
  const currentCommit = await checking.runtime.remoteHeadCommit();
  if (!codeMovedOn({ startupCommit, currentCommit })) return;
  checking.runtime.log.info(
    { startupCommit, currentCommit },
    "code update detected on the tracked remote branch",
  );
  checking.restart.request("code-updated");
};

const startedSchedulers = (starting: {
  readonly request: ModeRunRequest;
  readonly runtime: ComposedRuntime;
  readonly restart: RestartRequest;
  readonly idleMonitor: IdleMonitor;
  readonly baseline: Map<string, string>;
}): { readonly stop: () => void } => {
  const startedAtMs = Date.now();
  const statusBar = createPeriodicScheduler({
    checkRestart: () => {
      paintStatusBar({ request: starting.request, runtime: starting.runtime, startedAtMs });
      if (starting.idleMonitor.idleTooLong()) starting.restart.request("idle");
    },
    cleanup: { run: () => reclaimIdleWorktrees({ runtime: starting.runtime }) },
    log: starting.runtime.log,
  });
  const updateChecker = createPeriodicScheduler({
    checkRestart: () => void requestRestartWhenCodeMovedOn(starting),
    restartCheckIntervalMs: UPDATE_CHECK_INTERVAL_MS,
    log: starting.runtime.log,
  });
  statusBar.start();
  updateChecker.start();
  return {
    stop: () => {
      statusBar.stop();
      updateChecker.stop();
    },
  };
};

const restartRequestFor = (runtime: ComposedRuntime): RestartRequest =>
  createRestartRequest({
    onRequest: (reason) => {
      runtime.log.warn({ reason }, "restart requested; disconnecting without draining");
      runtime.disconnect();
    },
  });

export const runMode = async (request: ModeRunRequest): Promise<void> => {
  const runtime = runtimeFor(request);
  announceStart({ request, runtime });
  const restart = restartRequestFor(runtime);
  const idleMonitor = createIdleMonitor({
    startedAtMs: Date.now(),
    thresholdMs: IDLE_RESTART_THRESHOLD_MS,
    now: () => Date.now(),
  });
  const baseline = new Map<string, string>();
  const schedulers = startedSchedulers({ request, runtime, restart, idleMonitor, baseline });
  attachHandlers({
    request,
    runtime,
    github: createGithubApiClient({
      repository: request.repository,
      token: request.githubToken,
    }),
  });
  try {
    await cycleUntilStopped({ mode: request.mode, runtime, restart, idleMonitor, baseline });
  } finally {
    schedulers.stop();
  }
};
