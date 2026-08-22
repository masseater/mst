import { describe, expect, test, vi } from "vite-plus/test";

import { createModeRunner, type ModeRunRequest } from "./run-mode.ts";

import type { Mode } from "../contract/vocabulary.ts";
import type { HandlerGithubClient } from "../handlers/github-client.ts";
import type { LifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import type { Logger } from "../logging/logger.ts";
import type { JobQueue } from "../queue/job-queue.ts";
import type { ComposedRuntime, RuntimeWiring } from "../runtime/compose-runtime.ts";
import type { EventDispatcher } from "../runtime/event-dispatch.ts";
import type { SessionOrchestrator } from "../runtime/session-orchestrator.ts";
import type { CycleLoop } from "./cycle-loop.ts";

type ScheduleRequest = {
  readonly checkRestart: () => void;
  readonly restartCheckIntervalMs?: number;
  readonly cleanup?: { readonly run: () => Promise<void>; readonly intervalMs?: number };
  readonly log: Logger;
};

type JobHandler = (payload: unknown) => Promise<void>;

type PromptProbe = {
  readonly prNumber: number;
  readonly headBranch: string;
  readonly baseBranch?: string;
  readonly renderedPrompt: string;
};

const STARTED_AT_MS = Date.parse("2026-08-13T00:00:00.000Z");

describe("createModeRunner", () => {
  const it = test.extend("modeObservation", async () => {
    const modeObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
    const executeScenario = async (scenarioDescription: {
      readonly scenarioKey: "reviewer" | "author";
      readonly modeUnderTest: Mode;
      readonly engineCommand?: string;
      readonly remoteCommit: string;
      readonly duringCycle: (cycleProbe: {
        readonly cycleLoop: CycleLoop;
        readonly pullRequestJob: JobHandler;
        readonly statusSchedule: ScheduleRequest;
        readonly updateSchedule: ScheduleRequest;
        readonly setNow: (nextTimestampMs: number) => void;
        readonly remoteProbeCount: () => number;
        readonly disconnectCount: () => number;
      }) => Promise<void>;
    }): Promise<void> => {
      const runtimeLogger = {
        info: vi.fn<Logger["info"]>(),
        warn: vi.fn<Logger["warn"]>(),
        error: vi.fn<Logger["error"]>(),
      } satisfies Logger;
      const setJobHandlers = vi.fn<JobQueue["setHandlers"]>();
      const waitingLanes = ["maintenance", "pr-7", "pr-8"];
      const queue: JobQueue = {
        enqueue: () => true,
        enqueueFollowUp: () => true,
        setHandlers: setJobHandlers,
        runningLanes: () => ["pr-3"],
        waitingLanes: () => waitingLanes,
        size: () => ({ waiting: waitingLanes.length, running: 1 }),
        isIdle: () => false,
        admitsLane: () => true,
        cancelLane: () => 0,
        drain: () => Promise.resolve(),
        reserveLane: (_lane, reservedTask) => reservedTask(),
      };
      const gate: LifecycleGate = {
        openSignal: () => new AbortController().signal,
        close: () => undefined,
        excludeSession: () => undefined,
        interruptForInputChange: () => undefined,
        generationOf: () => 0,
        isCurrentGeneration: () => true,
        isClosed: () => false,
      };
      const recordPrompt = vi.fn<(promptProbe: PromptProbe) => void>();
      const orchestrator: SessionOrchestrator = {
        runInWorktree: async (sessionDescription) => {
          recordPrompt({
            prNumber: sessionDescription.prNumber,
            headBranch: sessionDescription.headBranch,
            ...(sessionDescription.baseBranch === undefined
              ? {}
              : { baseBranch: sessionDescription.baseBranch }),
            renderedPrompt: await sessionDescription.buildPrompt(
              `/worktrees/pr-${sessionDescription.prNumber}`,
            ),
          });
        },
      };
      const dispatcher: EventDispatcher = { dispatch: () => true };
      const disconnect = vi.fn<ComposedRuntime["disconnect"]>();
      const remoteHeadCommit = vi.fn<ComposedRuntime["remoteHeadCommit"]>(() =>
        Promise.resolve(scenarioDescription.remoteCommit),
      );
      const killEngine = vi.fn<ComposedRuntime["killEngine"]>(() => Promise.resolve());
      const worktreeIsStale = vi.fn<ComposedRuntime["worktreeIsStale"]>((stalenessCheck) =>
        Promise.resolve(stalenessCheck.branch === "pr-8"),
      );
      const runtime: ComposedRuntime = {
        log: runtimeLogger,
        syncToMain: () => Promise.resolve(),
        drainStartup: () => Promise.resolve([]),
        connect: () => Promise.resolve(),
        subscribe: async function* subscribe() {
          await Promise.resolve();
          yield* [];
        },
        dispatcher,
        queue,
        gate,
        orchestrator,
        disconnect,
        remoteHeadCommit,
        killEngine,
        worktreeIsStale,
      };
      const githubClient: HandlerGithubClient = {
        prSnapshot: () => Promise.reject(new Error("not used by the wiring test")),
        createCommitStatus: () => Promise.resolve(),
        listReviews: () => Promise.resolve([]),
        requestReviewers: () => Promise.resolve(),
      };
      const recordGithubClient =
        vi.fn<
          (clientDescription: { readonly repository: string; readonly token: string }) => void
        >();
      const recordReviewerCall = vi.fn<(prNumber: number) => void>();
      const recordAuthorCall =
        vi.fn<(authorJobInput: { readonly prNumber: number; readonly reason: string }) => void>();
      const recordCoordination =
        vi.fn<
          (coordinationInput: { readonly prNumber: number; readonly endpoint: string }) => void
        >();
      const recordBanner =
        vi.fn<(bannerDescription: { readonly mode: Mode; readonly prNumber: number }) => void>();
      const recordDirectory = vi.fn<(directoryPath: string) => void>();
      const recordRunContextPath = vi.fn<(runContextPath: string) => void>();
      const nowClock = vi.fn<() => number>(() => STARTED_AT_MS);
      const schedulerLifecycle = vi.fn<(schedulerRole: string, lifecyclePhase: string) => void>();
      const createPeriodicScheduler = vi.fn<
        (scheduleDescription: ScheduleRequest) => {
          readonly start: () => undefined;
          readonly stop: () => Promise<void>;
        }
      >((scheduleDescription) => {
        const schedulerRole =
          scheduleDescription.restartCheckIntervalMs === undefined ? "status" : "update";
        modeObservation(`${scenarioDescription.scenarioKey} ${schedulerRole} schedule`, {
          restartCheckIntervalMs: scheduleDescription.restartCheckIntervalMs ?? null,
          hasCleanup: scheduleDescription.cleanup !== undefined,
        });
        return {
          start: () => {
            schedulerLifecycle(schedulerRole, "start");
            return undefined;
          },
          stop: () => {
            schedulerLifecycle(schedulerRole, "stop");
            return Promise.resolve();
          },
        };
      });
      const recordCycle = vi.fn<(cycleLoop: CycleLoop) => void>();

      const runMode = createModeRunner({
        composeRuntime: (runtimeWiring: RuntimeWiring) => {
          modeObservation(`${scenarioDescription.scenarioKey} runtime wiring`, {
            mode: runtimeWiring.mode,
            relayOrigin: runtimeWiring.relayOrigin,
            repositoryRootIsWorkingDirectory: runtimeWiring.repoDir === process.cwd(),
            logDirectory: runtimeWiring.logDirectory,
            engineKind: runtimeWiring.engineKind,
            engineOverride: runtimeWiring.engineOverride ?? null,
            engineTimeoutMs: runtimeWiring.engineTimeoutMs,
            bypassPermissions: runtimeWiring.bypassPermissions,
            concurrency: runtimeWiring.concurrency,
            prFilter: runtimeWiring.prFilter,
            githubToken: runtimeWiring.githubToken,
            hasWorktreeSetup: typeof runtimeWiring.setupWorktree === "function",
          });
          return runtime;
        },
        createAuthorHandler: (authorConfiguration) => async (authorJobInput) => {
          recordAuthorCall(authorJobInput);
          if (authorJobInput.prNumber === 0) return;
          await authorConfiguration.runSession({
            prNumber: authorJobInput.prNumber,
            headBranch: "feature/author",
            reason: authorJobInput.reason,
          });
        },
        createGithubApiClient: (clientDescription) => {
          recordGithubClient(clientDescription);
          return githubClient;
        },
        createPeriodicScheduler,
        createReviewInputCoordinator: (coordinatorConfiguration) => async (coordinationInput) => {
          recordCoordination(coordinationInput);
          await coordinatorConfiguration.stopSession(coordinationInput.prNumber);
          return true;
        },
        createReviewerHandler: (reviewerConfiguration) => async (prNumber) => {
          recordReviewerCall(prNumber);
          await reviewerConfiguration.runSession({
            prNumber,
            headBranch: "feature/reviewer",
            baseBranch: "main",
          });
          reviewerConfiguration.requestFollowUpReview({ prNumber, endpoint: "head" });
        },
        cycleUntilStopped: async (cycleLoop) => {
          recordCycle(cycleLoop);
          const jobHandlerWiring = setJobHandlers.mock.calls.at(0)?.[0];
          const pullRequestJob = jobHandlerWiring?.handlers["pr-event"];
          const statusSchedule = createPeriodicScheduler.mock.calls.find(
            ([scheduleDescription]) => scheduleDescription.restartCheckIntervalMs === undefined,
          )?.[0];
          const updateSchedule = createPeriodicScheduler.mock.calls.find(
            ([scheduleDescription]) => scheduleDescription.restartCheckIntervalMs !== undefined,
          )?.[0];
          if (
            pullRequestJob === undefined ||
            statusSchedule === undefined ||
            updateSchedule === undefined
          ) {
            throw new Error("mode runner did not attach its jobs and schedules");
          }
          await scenarioDescription.duringCycle({
            cycleLoop,
            pullRequestJob,
            statusSchedule,
            updateSchedule,
            setNow: (nextTimestampMs) => {
              nowClock.mockReturnValue(nextTimestampMs);
            },
            remoteProbeCount: () => remoteHeadCommit.mock.calls.length,
            disconnectCount: () => disconnect.mock.calls.length,
          });
        },
        environment: {
          AUTO_DEVELOP_LOG_DIR: "/runtime-logs",
          ...(scenarioDescription.engineCommand === undefined
            ? {}
            : { AUTO_DEVELOP_ENGINE_COMMAND: scenarioDescription.engineCommand }),
        },
        now: nowClock,
        runContextFs: {
          mkdirRecursive: recordDirectory,
          writeJson: (runContextPath) => {
            recordRunContextPath(runContextPath);
          },
        },
        runJob: async (bannerDescription) => {
          recordBanner({ mode: bannerDescription.mode, prNumber: bannerDescription.prNumber });
          return bannerDescription.run();
        },
        stdoutWidth: 120,
      });

      const asked: ModeRunRequest = {
        mode: scenarioDescription.modeUnderTest,
        relayOrigin: "https://relay.example.test",
        repository: "owner/repository",
        githubToken: "github-token",
        concurrency: 3,
        prFilter: { targetPrs: [7, 8], excludedPrs: [9] },
        dryRun: false,
        reviewerLogin: "review-bot",
        bypassPermissions: true,
        engineTimeoutMs: 45_000,
      };
      const runFailure = await (async () => {
        try {
          await runMode(asked);
          return null;
        } catch (caughtFailure) {
          return caughtFailure;
        }
      })();

      modeObservation(`${scenarioDescription.scenarioKey} run failure`, runFailure);
      modeObservation(
        `${scenarioDescription.scenarioKey} github clients`,
        recordGithubClient.mock.calls.map(([clientDescription]) => clientDescription),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} reviewer calls`,
        recordReviewerCall.mock.calls.map(([prNumber]) => prNumber),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} author calls`,
        recordAuthorCall.mock.calls.map(([authorJobInput]) => authorJobInput),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} coordinated inputs`,
        recordCoordination.mock.calls.map(([coordinationInput]) => coordinationInput),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} engine kills`,
        killEngine.mock.calls.map(([prNumber]) => prNumber),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} banners`,
        recordBanner.mock.calls.map(([bannerDescription]) => bannerDescription),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} prompts`,
        recordPrompt.mock.calls.map(([promptProbe]) => promptProbe),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} run context directories`,
        recordDirectory.mock.calls.map(([directoryPath]) => directoryPath),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} run context paths`,
        recordRunContextPath.mock.calls.map(([runContextPath]) => runContextPath),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} staleness branches`,
        worktreeIsStale.mock.calls.map(([stalenessCheck]) => stalenessCheck.branch),
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} status line count`,
        runtimeLogger.info.mock.calls.filter(([logFields]) => logFields.statusBar === true).length,
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} disconnect count`,
        disconnect.mock.calls.length,
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} remote probe count`,
        remoteHeadCommit.mock.calls.length,
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} cycle count`,
        recordCycle.mock.calls.length,
      );
      for (const schedulerRole of ["status", "update"] as const) {
        for (const lifecyclePhase of ["start", "stop"] as const) {
          modeObservation(
            `${scenarioDescription.scenarioKey} ${schedulerRole} scheduler ${lifecyclePhase} count`,
            schedulerLifecycle.mock.calls.filter(
              ([observedRole, observedPhase]) =>
                observedRole === schedulerRole && observedPhase === lifecyclePhase,
            ).length,
          );
        }
      }
      modeObservation(`${scenarioDescription.scenarioKey} warnings`, runtimeLogger.warn.mock.calls);
      modeObservation(
        `${scenarioDescription.scenarioKey} runtime start log`,
        runtimeLogger.info.mock.calls.find(([, logText]) => logText === "runtime starting") ?? null,
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} reclaimed worktree lane`,
        runtimeLogger.info.mock.calls
          .find(([, logText]) => logText === "worktree is idle and can be reclaimed")?.[0]
          .worktreePath?.toString()
          .split("/")
          .at(-1) ?? null,
      );
      modeObservation(
        `${scenarioDescription.scenarioKey} code update log`,
        runtimeLogger.info.mock.calls.find(
          ([, logText]) => logText === "code update detected on the tracked remote branch",
        ) ?? null,
      );
    };

    await executeScenario({
      scenarioKey: "reviewer",
      modeUnderTest: "reviewer",
      remoteCommit: "startup-commit",
      duringCycle: async ({
        cycleLoop,
        pullRequestJob,
        statusSchedule,
        updateSchedule,
        setNow,
        remoteProbeCount,
      }) => {
        await pullRequestJob({ pullNumber: 7 });
        setNow(STARTED_AT_MS + 29 * 60_000);
        statusSchedule.checkRestart();
        setNow(STARTED_AT_MS + 30 * 60_000);
        statusSchedule.checkRestart();
        await statusSchedule.cleanup?.run();
        updateSchedule.checkRestart();
        modeObservation("reviewer remote probe count before baseline", remoteProbeCount());
        cycleLoop.baseline.set("commit", "startup-commit");
        updateSchedule.checkRestart();
        await vi.waitFor(() => {
          if (remoteProbeCount() !== 1) throw new Error("remote head probe has not completed");
        });
      },
    });

    const cycleFailure = new Error("cycle failed");
    await executeScenario({
      scenarioKey: "author",
      modeUnderTest: "author",
      engineCommand: "custom-engine --headless",
      remoteCommit: "updated-commit",
      duringCycle: async ({ cycleLoop, pullRequestJob, updateSchedule, disconnectCount }) => {
        await pullRequestJob({ pullNumber: "invalid" });
        await pullRequestJob({ pullNumber: 8 });
        cycleLoop.baseline.set("commit", "startup-commit");
        updateSchedule.checkRestart();
        await vi.waitFor(() => {
          if (disconnectCount() !== 1) throw new Error("restart disconnect has not completed");
        });
        throw cycleFailure;
      },
    });

    return modeObservation;
  });

  it("wires the reviewer runtime", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer runtime wiring", {
      mode: "reviewer",
      relayOrigin: "https://relay.example.test",
      repositoryRootIsWorkingDirectory: true,
      logDirectory: "/runtime-logs",
      engineKind: "claude",
      engineOverride: null,
      engineTimeoutMs: 45_000,
      bypassPermissions: true,
      concurrency: 3,
      prFilter: { targetPrs: [7, 8], excludedPrs: [9] },
      githubToken: "github-token",
      hasWorktreeSetup: true,
    });
  });

  it("creates the reviewer GitHub client", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer github clients", [
      { repository: "owner/repository", token: "github-token" },
    ]);
  });

  it("routes the pull request job to the reviewer", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer reviewer calls", [7]);
  });

  it("does not route the reviewer job to the author", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer author calls", []);
  });

  it("coordinates a follow-up review after the reviewer finishes", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer coordinated inputs", [
      { prNumber: 7, endpoint: "head" },
    ]);
  });

  it("kills the reviewed pull request engine during coordination", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer engine kills", [7]);
  });

  it("runs the reviewer job through its banner", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer banners", [
      { mode: "reviewer", prNumber: 7 },
    ]);
  });

  it("builds the reviewer prompt from the prepared run context", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer prompts", [
      {
        prNumber: 7,
        headBranch: "feature/reviewer",
        baseBranch: "main",
        renderedPrompt: `/auto-develop-review review

PR #7
(base: origin/main, head: feature/reviewer)
Run context: /worktrees/pr-7/.repo-workflow/review/7-2026-08-13T00-00-00-000Z/inventory.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch in this worktree. Review the target PR and comment. Use the run context when it is valid; regenerate it with the reviewer CLI subcommand only when it is missing or invalid. The diff and guidelines are not passed inline. Launch the per-review subagents, decide the verdict, and submit the GitHub review as the skill defines.`,
      },
    ]);
  });

  it("prepares both reviewer run context directories", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer run context directories", [
      "/worktrees/pr-7/.repo-workflow/review/7-2026-08-13T00-00-00-000Z/findings",
      "/worktrees/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-2026-08-13T00-00-00-000Z",
    ]);
  });

  it("writes the reviewer run context to its inventory path", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer run context paths", [
      "/worktrees/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-2026-08-13T00-00-00-000Z/run-context.json",
    ]);
  });

  it("probes every queued pull request worktree", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer staleness branches", ["pr-7", "pr-8"]);
  });

  it("identifies the reclaimable queued worktree", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer reclaimed worktree lane", "pr-8");
  });

  it("renders six status lines across two checks", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer status line count", 6);
  });

  it("requests one disconnect after the idle threshold", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer disconnect count", 1);
  });

  it("does not probe the remote head before a baseline exists", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer remote probe count before baseline", 0);
  });

  it("probes the remote head after a baseline exists", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer remote probe count", 1);
  });

  it("starts the reviewer status scheduler", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer status scheduler start count", 1);
  });

  it("starts the reviewer update scheduler", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer update scheduler start count", 1);
  });

  it("stops the reviewer status scheduler", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer status scheduler stop count", 1);
  });

  it("stops the reviewer update scheduler", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer update scheduler stop count", 1);
  });

  it("checks reviewer code updates every fifteen minutes", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer update schedule", {
      restartCheckIntervalMs: 900_000,
      hasCleanup: false,
    });
  });

  it("runs one reviewer connection cycle", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer cycle count", 1);
  });

  it("logs the reviewer runtime metadata exactly", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer runtime start log", [
      {
        mode: "reviewer",
        engine: "claude",
        engineCommand: "claude",
        engineOverrideSource: "default",
        ghUserSource: "override",
        ghTokenSource: "environment-variable",
        concurrency: 3,
        dryRun: false,
        dangerouslySkipPermissions: true,
        targetPrs: [7, 8],
        excludedPrs: [9],
      },
      "runtime starting",
    ]);
  });

  it("logs the idle restart request", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer warnings", [
      [{ reason: "idle" }, "restart requested; disconnecting without draining"],
    ]);
  });

  it("finishes the reviewer run successfully", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("reviewer run failure", null);
  });

  it("wires the author runtime with its engine override", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author runtime wiring", {
      mode: "author",
      relayOrigin: "https://relay.example.test",
      repositoryRootIsWorkingDirectory: true,
      logDirectory: "/runtime-logs",
      engineKind: "claude",
      engineOverride: "custom-engine --headless",
      engineTimeoutMs: 45_000,
      bypassPermissions: true,
      concurrency: 3,
      prFilter: { targetPrs: [7, 8], excludedPrs: [9] },
      githubToken: "github-token",
      hasWorktreeSetup: true,
    });
  });

  it("does not route author jobs to the reviewer", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author reviewer calls", []);
  });

  it("normalizes an invalid pull number before routing author jobs", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author author calls", [
      { prNumber: 0, reason: "request_changes" },
      { prNumber: 8, reason: "request_changes" },
    ]);
  });

  it("runs both author jobs through their banners", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author banners", [
      { mode: "author", prNumber: 0 },
      { mode: "author", prNumber: 8 },
    ]);
  });

  it("builds the author prompt from the prepared run context", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author prompts", [
      {
        prNumber: 8,
        headBranch: "feature/author",
        renderedPrompt: `/auto-develop-fix

PR #8
(base: feature/author, head: feature/author)
Task: request_changes
Run context: /worktrees/pr-8/.repo-workflow/author/8-2026-08-13T00-00-00-000Z/inventory.json

Do not ask the user for confirmation, approval, prioritization, or extra instructions. Complete the workflow from the repository, GitHub, and CI context, or report the failure result the skill defines.

You are already checked out on the PR branch. Use the run context when it is valid; regenerate it with the author CLI subcommand only when it is missing or invalid. Address every review comment, review-summary item, CI failure, base update, and merge conflict, commit and push, and reply on the target PR. The diff is not passed inline.`,
      },
    ]);
  });

  it("logs the detected author code update", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author code update log", [
      { startupCommit: "startup-commit", currentCommit: "updated-commit" },
      "code update detected on the tracked remote branch",
    ]);
  });

  it("logs the code-update restart request", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author warnings", [
      [{ reason: "code-updated" }, "restart requested; disconnecting without draining"],
    ]);
  });

  it("disconnects once after the author code update", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author disconnect count", 1);
  });

  it("stops the author status scheduler after failure", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author status scheduler stop count", 1);
  });

  it("stops the author update scheduler after failure", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author update scheduler stop count", 1);
  });

  it("propagates the author cycle failure", ({ modeObservation }) => {
    expect(modeObservation).toHaveBeenCalledWith("author run failure", new Error("cycle failed"));
  });
});
