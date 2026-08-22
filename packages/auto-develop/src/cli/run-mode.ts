import { DEFAULT_ENGINE } from "../config/engine.ts";
import { readEnvVar } from "../config/env.ts";
import { resolveLogDirectory } from "../config/log-directory.ts";
import { resolveRepositoryRoot } from "../config/repository-root.ts";
import { prepareRunContext } from "../context/prepare-run-context.ts";
import { buildPrompt } from "../context/prompt.ts";
import { LAUNCH_AUTO } from "../context/run-context.ts";
import { asRecord } from "../contract/unknown-record.ts";
import { DECLARED_MODE, type Mode } from "../contract/vocabulary.ts";
import { AUTHOR_REASON, createAuthorHandler } from "../handlers/author-handler.ts";
import { createGithubApiClient } from "../handlers/github-api-client.ts";
import { createReviewInputCoordinator } from "../handlers/review-input-coordinator.ts";
import { createReviewerHandler } from "../handlers/reviewer-handler.ts";
import { withJobBanner } from "../queue/job-banner.ts";
import { prLaneNumber, type PrFilter } from "../queue/pr-lane.ts";
import { createPeriodicScheduler, type PeriodicSchedule } from "../queue/scheduler.ts";
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

type ModeScheduler = {
  readonly start: () => ModeScheduler | undefined;
  readonly stop: () => Promise<void> | undefined;
};

const startScheduler = (scheduler: ModeScheduler): ModeScheduler => scheduler.start() ?? scheduler;

type ModeRunDependencies = {
  readonly composeRuntime: typeof composeRuntime;
  readonly createAuthorHandler: typeof createAuthorHandler;
  readonly createGithubApiClient: typeof createGithubApiClient;
  readonly createPeriodicScheduler: (schedule: PeriodicSchedule) => ModeScheduler;
  readonly createReviewInputCoordinator: typeof createReviewInputCoordinator;
  readonly createReviewerHandler: typeof createReviewerHandler;
  readonly cycleUntilStopped: typeof cycleUntilStopped;
  readonly environment: Readonly<Record<string, unknown>>;
  readonly now: () => number;
  readonly runContextFs: typeof runContextFsOnDisk;
  readonly runJob: typeof withJobBanner;
  readonly stdoutWidth: number;
};

const MODE_RUN_DEPENDENCIES: ModeRunDependencies = {
  composeRuntime,
  createAuthorHandler,
  createGithubApiClient,
  createPeriodicScheduler,
  createReviewInputCoordinator,
  createReviewerHandler,
  cycleUntilStopped,
  environment: process.env,
  now: Date.now,
  runContextFs: runContextFsOnDisk,
  runJob: withJobBanner,
  stdoutWidth: process.stdout.columns,
};

const promptFor = (
  build: {
    readonly mode: Mode;
    readonly prNumber: number;
    readonly baseRef: string;
    readonly headRef: string;
    readonly worktreePath: string;
    readonly reason?: string;
  },
  dependencies: ModeRunDependencies,
): string => {
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
    fs: dependencies.runContextFs,
    nowIso: () => new Date(dependencies.now()).toISOString(),
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

const runtimeFor = (asked: ModeRunRequest, dependencies: ModeRunDependencies): ComposedRuntime => {
  const repoDir = resolveRepositoryRoot(process.cwd());
  const engineCommand = readEnvVar("AUTO_DEVELOP_ENGINE_COMMAND", dependencies.environment);
  return dependencies.composeRuntime({
    mode: asked.mode,
    relayOrigin: asked.relayOrigin,
    repoDir,
    logDirectory: resolveLogDirectory(repoDir, dependencies.environment),
    engineKind: DEFAULT_ENGINE,
    ...(engineCommand === undefined ? {} : { engineOverride: engineCommand }),
    engineTimeoutMs: asked.engineTimeoutMs,
    bypassPermissions: asked.bypassPermissions,
    concurrency: asked.concurrency,
    prFilter: asked.prFilter,
    githubToken: asked.githubToken,
    setupWorktree: () => Promise.resolve(),
  });
};

const pullNumberOf = (carried: unknown): number => {
  const pullNumber = asRecord(carried)?.pullNumber;
  return typeof pullNumber === "number" ? pullNumber : 0;
};

const attachHandlers = (attaching: {
  readonly request: ModeRunRequest;
  readonly runtime: ComposedRuntime;
  readonly github: HandlerGithubClient;
  readonly dependencies: ModeRunDependencies;
}): void => {
  const { request: asked, runtime, github, dependencies } = attaching;
  const coordinate = dependencies.createReviewInputCoordinator({
    gate: runtime.gate,
    queue: runtime.queue,
    stopSession: (prNumber) => runtime.killEngine(prNumber),
    jobType: "review-input-changed",
    log: runtime.log,
  });
  const reviewer = dependencies.createReviewerHandler({
    github,
    gate: runtime.gate,
    runSession: (session) =>
      runtime.orchestrator.runInWorktree({
        prNumber: session.prNumber,
        headBranch: session.headBranch,
        baseBranch: session.baseBranch,
        buildPrompt: (worktreePath) =>
          Promise.resolve(
            promptFor(
              {
                mode: asked.mode,
                prNumber: session.prNumber,
                baseRef: `origin/${session.baseBranch}`,
                headRef: session.headBranch,
                worktreePath,
              },
              dependencies,
            ),
          ),
      }),
    requestFollowUpReview: (followUp) => {
      void coordinate({ prNumber: followUp.prNumber, endpoint: followUp.endpoint });
    },
    dryRun: asked.dryRun,
    proxyLogin: asked.reviewerLogin,
    log: runtime.log,
  });
  const author = dependencies.createAuthorHandler({
    github,
    runSession: (session) =>
      runtime.orchestrator.runInWorktree({
        prNumber: session.prNumber,
        headBranch: session.headBranch,
        buildPrompt: (worktreePath) =>
          Promise.resolve(
            promptFor(
              {
                mode: asked.mode,
                prNumber: session.prNumber,
                baseRef: session.headBranch,
                headRef: session.headBranch,
                worktreePath,
                reason: session.reason,
              },
              dependencies,
            ),
          ),
      }),
    reviewerLogin: asked.reviewerLogin,
    dryRun: asked.dryRun,
    log: runtime.log,
  });
  runtime.queue.setHandlers({
    handlers: {
      "pr-event": (carried) => {
        const prNumber = pullNumberOf(carried);
        return dependencies.runJob({
          mode: asked.mode,
          prNumber,
          run: async () => {
            if (asked.mode === DECLARED_MODE.reviewer) {
              await reviewer(prNumber);
              return;
            }
            await author({ prNumber, reason: AUTHOR_REASON.requestChanges });
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
  readonly dependencies: ModeRunDependencies;
}): void => {
  const lines = renderStatusBar({
    snapshot: {
      mode: painting.request.mode,
      engineCommand: DEFAULT_ENGINE,
      connected: true,
      runningLanes: painting.runtime.queue.runningLanes(),
      waitingLanes: painting.runtime.queue.waitingLanes(),
      uptimeMs: painting.dependencies.now() - painting.startedAtMs,
    },
    width: painting.dependencies.stdoutWidth,
  });
  for (const line of lines) painting.runtime.log.info({ statusBar: true }, line);
};

const announceStart = (announcing: {
  readonly request: ModeRunRequest;
  readonly runtime: ComposedRuntime;
}): void => {
  const { request: asked } = announcing;
  announcing.runtime.log.info(
    runMetadataLogFields(
      buildRunMetadata({
        mode: asked.mode,
        engine: DEFAULT_ENGINE,
        ghUser: asked.reviewerLogin,
        ghUserSource: "override",
        ghTokenSource: "environment-variable",
        concurrency: asked.concurrency,
        dryRun: asked.dryRun,
        dangerouslySkipPermissions: asked.bypassPermissions,
        targetPrs: asked.prFilter.targetPrs,
        excludedPrs: asked.prFilter.excludedPrs,
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
  readonly dependencies: ModeRunDependencies;
}): { readonly stop: () => Promise<void> } => {
  const startedAtMs = starting.dependencies.now();
  const statusBar = startScheduler(
    starting.dependencies.createPeriodicScheduler({
      checkRestart: () => {
        paintStatusBar({
          request: starting.request,
          runtime: starting.runtime,
          startedAtMs,
          dependencies: starting.dependencies,
        });
        if (starting.idleMonitor.idleTooLong()) starting.restart.request("idle");
      },
      cleanup: { run: () => reclaimIdleWorktrees({ runtime: starting.runtime }) },
      log: starting.runtime.log,
    }),
  );
  const updateChecker = startScheduler(
    starting.dependencies.createPeriodicScheduler({
      checkRestart: () => void requestRestartWhenCodeMovedOn(starting),
      restartCheckIntervalMs: UPDATE_CHECK_INTERVAL_MS,
      log: starting.runtime.log,
    }),
  );
  return {
    stop: async () => {
      await Promise.all([statusBar.stop(), updateChecker.stop()]);
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

export const createModeRunner = (
  overrides: Partial<ModeRunDependencies> = {},
): ((asked: ModeRunRequest) => Promise<void>) => {
  const dependencies: ModeRunDependencies = { ...MODE_RUN_DEPENDENCIES, ...overrides };
  return async (asked) => {
    const runtime = runtimeFor(asked, dependencies);
    announceStart({ request: asked, runtime });
    const restart = restartRequestFor(runtime);
    const idleMonitor = createIdleMonitor({
      startedAtMs: dependencies.now(),
      thresholdMs: IDLE_RESTART_THRESHOLD_MS,
      now: () => dependencies.now(),
    });
    const baseline = new Map<string, string>();
    const schedulers = startedSchedulers({
      request: asked,
      runtime,
      restart,
      idleMonitor,
      baseline,
      dependencies,
    });
    attachHandlers({
      request: asked,
      runtime,
      github: dependencies.createGithubApiClient({
        repository: asked.repository,
        token: asked.githubToken,
      }),
      dependencies,
    });
    try {
      await dependencies.cycleUntilStopped({
        mode: asked.mode,
        runtime,
        restart,
        idleMonitor,
        baseline,
      });
    } finally {
      await schedulers.stop();
    }
  };
};
