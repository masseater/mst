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

type ScheduledProbe = {
  readonly request: ScheduleRequest;
  readonly start: () => void;
  readonly stop: () => void;
};

type JobHandler = (payload: unknown) => Promise<void>;

type CycleProbe = {
  readonly cycle: CycleLoop;
  readonly handlers: Map<string, JobHandler>;
  readonly schedulers: ScheduledProbe[];
  readonly setNow: (nowMs: number) => void;
  readonly setRemoteCommit: (commit: string | null) => void;
};

type Scenario = {
  readonly mode: Mode;
  readonly engineCommand?: string;
  readonly duringCycle: (probe: CycleProbe) => Promise<void>;
};

type PromptProbe = {
  readonly prNumber: number;
  readonly headBranch: string;
  readonly baseBranch?: string;
  readonly prompt: string;
};

const STARTED_AT_MS = Date.parse("2026-08-13T00:00:00.000Z");

const requestFor = (mode: Mode): ModeRunRequest => ({
  mode,
  relayOrigin: "https://relay.example.test",
  repository: "owner/repository",
  githubToken: "github-token",
  concurrency: 3,
  prFilter: { targetPrs: [7, 8], excludedPrs: [9] },
  dryRun: false,
  reviewerLogin: "review-bot",
  bypassPermissions: true,
  engineTimeoutMs: 45_000,
});

const scenarioFixture = (scenario: Scenario) => {
  const logger = {
    info: vi.fn<Logger["info"]>(),
    warn: vi.fn<Logger["warn"]>(),
    error: vi.fn<Logger["error"]>(),
  } satisfies Logger;
  const handlers = new Map<string, JobHandler>();
  const waitingLanes = ["maintenance", "pr-7", "pr-8"];
  const queue: JobQueue = {
    enqueue: () => true,
    enqueueFollowUp: () => true,
    setHandlers: (wiring) => {
      handlers.clear();
      for (const [type, handler] of Object.entries(wiring.handlers)) handlers.set(type, handler);
    },
    runningLanes: () => ["pr-3"],
    waitingLanes: () => waitingLanes,
    size: () => ({ waiting: waitingLanes.length, running: 1 }),
    isIdle: () => false,
    admitsLane: () => true,
    cancelLane: () => 0,
    drain: () => Promise.resolve(),
    reserveLane: async (_lane, task) => task(),
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
  const recordPrompt = vi.fn<(probe: PromptProbe) => void>();
  const orchestrator: SessionOrchestrator = {
    runInWorktree: async (session) => {
      recordPrompt({
        prNumber: session.prNumber,
        headBranch: session.headBranch,
        ...(session.baseBranch === undefined ? {} : { baseBranch: session.baseBranch }),
        prompt: await session.buildPrompt(`/worktrees/pr-${session.prNumber}`),
      });
    },
  };
  const dispatcher: EventDispatcher = { dispatch: () => true };
  const remoteCommit = new Map<string, string | null>([["value", "startup-commit"]]);
  const disconnect = vi.fn<ComposedRuntime["disconnect"]>();
  const remoteHeadCommit = vi.fn<ComposedRuntime["remoteHeadCommit"]>(() =>
    Promise.resolve(remoteCommit.get("value") ?? null),
  );
  const killEngine = vi.fn<ComposedRuntime["killEngine"]>(() => Promise.resolve());
  const worktreeIsStale = vi.fn<ComposedRuntime["worktreeIsStale"]>((check) =>
    Promise.resolve(check.branch === "pr-8"),
  );
  const runtime: ComposedRuntime = {
    log: logger,
    syncToMain: () => Promise.resolve(),
    drainStartup: () => Promise.resolve([]),
    connect: () => Promise.resolve(),
    subscribe: async function* () {
      yield {};
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
  const github: HandlerGithubClient = {
    prSnapshot: () => Promise.reject(new Error("not used by the wiring test")),
    createCommitStatus: () => Promise.resolve(),
    listReviews: () => Promise.resolve([]),
    requestReviewers: () => Promise.resolve(),
  };
  const recordRuntimeWiring = vi.fn<(wiring: RuntimeWiring) => void>();
  const recordGithubClient =
    vi.fn<(client: { readonly repository: string; readonly token: string }) => void>();
  const recordReviewer = vi.fn<(prNumber: number) => void>();
  const recordAuthor =
    vi.fn<(event: { readonly prNumber: number; readonly reason: string }) => void>();
  const recordCoordinate =
    vi.fn<(event: { readonly prNumber: number; readonly endpoint: string }) => void>();
  const recordBanner =
    vi.fn<(banner: { readonly mode: Mode; readonly prNumber: number }) => void>();
  const recordDirectory = vi.fn<(directory: string) => void>();
  const recordContext =
    vi.fn<(context: { readonly path: string; readonly value: unknown }) => void>();
  const recordCycle = vi.fn<(cycle: CycleLoop) => void>();
  const schedulers = new Map<number, ScheduledProbe>();
  const nowMs = new Map([["value", STARTED_AT_MS]]);

  const run = createModeRunner({
    composeRuntime: (wiring) => {
      recordRuntimeWiring(wiring);
      void wiring.setupWorktree("/setup/worktree");
      return runtime;
    },
    createAuthorHandler: (config) => async (event) => {
      recordAuthor(event);
      if (event.prNumber === 0) return;
      await config.runSession({
        prNumber: event.prNumber,
        headBranch: "feature/author",
        reason: event.reason,
      });
    },
    createGithubApiClient: (config) => {
      recordGithubClient(config);
      return github;
    },
    createPeriodicScheduler: (request) => {
      const start = vi.fn<() => void>();
      const stop = vi.fn<() => void>();
      const scheduled: ScheduledProbe = { request, start, stop };
      schedulers.set(schedulers.size, scheduled);
      return {
        start,
        stop,
        isRunning: () => start.mock.calls.length > stop.mock.calls.length,
      };
    },
    createReviewInputCoordinator: (config) => async (event) => {
      recordCoordinate(event);
      await config.stopSession(event.prNumber);
      return true;
    },
    createReviewerHandler: (config) => async (prNumber) => {
      recordReviewer(prNumber);
      await config.runSession({
        prNumber,
        headBranch: "feature/reviewer",
        baseBranch: "main",
      });
      config.requestFollowUpReview({ prNumber, endpoint: "head" });
    },
    cycleUntilStopped: async (cycle) => {
      recordCycle(cycle);
      await scenario.duringCycle({
        cycle,
        handlers,
        schedulers: [...schedulers.values()],
        setNow: (nextNowMs) => {
          nowMs.set("value", nextNowMs);
        },
        setRemoteCommit: (commit) => {
          remoteCommit.set("value", commit);
        },
      });
    },
    environment: {
      AUTO_DEVELOP_LOG_DIR: "/runtime-logs",
      ...(scenario.engineCommand === undefined
        ? {}
        : { AUTO_DEVELOP_ENGINE_COMMAND: scenario.engineCommand }),
    },
    now: () => nowMs.get("value") ?? STARTED_AT_MS,
    runContextFs: {
      mkdirRecursive: recordDirectory,
      writeJson: (path, value) => {
        recordContext({ path, value });
      },
    },
    runJob: async (banner) => {
      recordBanner({ mode: banner.mode, prNumber: banner.prNumber });
      return banner.run();
    },
    stdoutWidth: 120,
  });

  return {
    run: () => run(requestFor(scenario.mode)),
    logger,
    prompts: () => recordPrompt.mock.calls.map(([prompt]) => prompt),
    runtimeWirings: () => recordRuntimeWiring.mock.calls.map(([wiring]) => wiring),
    githubClients: () => recordGithubClient.mock.calls.map(([client]) => client),
    reviewerCalls: () => recordReviewer.mock.calls.map(([prNumber]) => prNumber),
    authorCalls: () => recordAuthor.mock.calls.map(([event]) => event),
    coordinated: () => recordCoordinate.mock.calls.map(([event]) => event),
    banners: () => recordBanner.mock.calls.map(([banner]) => banner),
    directories: () => recordDirectory.mock.calls.map(([directory]) => directory),
    writtenContexts: () => recordContext.mock.calls.map(([context]) => context),
    schedulers: () => [...schedulers.values()],
    cycles: () => recordCycle.mock.calls.map(([cycle]) => cycle),
    disconnect,
    remoteHeadCommit,
    killEngine,
    worktreeIsStale,
  };
};

const prEventHandler = (handlers: Map<string, JobHandler>): JobHandler => {
  const handler = handlers.get("pr-event");
  if (handler === undefined) throw new Error("pr-event handler was not attached");
  return handler;
};

const statusAndUpdateSchedulers = (
  schedulers: readonly ScheduledProbe[],
): { readonly status: ScheduledProbe; readonly update: ScheduledProbe } => {
  const [status, update] = schedulers;
  if (status === undefined || update === undefined) throw new Error("schedulers were not started");
  return { status, update };
};

describe("createModeRunner", () => {
  test("wires reviewer jobs, prompts, status, idle restart and worktree reclamation", async () => {
    const fixture = scenarioFixture({
      mode: "reviewer",
      duringCycle: async ({ cycle, handlers, schedulers, setNow, setRemoteCommit }) => {
        const { status, update } = statusAndUpdateSchedulers(schedulers);
        await prEventHandler(handlers)({ pullNumber: 7 });
        setNow(STARTED_AT_MS + 29 * 60_000);
        status.request.checkRestart();
        setNow(STARTED_AT_MS + 30 * 60_000);
        status.request.checkRestart();
        await status.request.cleanup?.run();
        update.request.checkRestart();
        expect(fixture.remoteHeadCommit).not.toHaveBeenCalled();
        cycle.baseline.set("commit", "startup-commit");
        setRemoteCommit("startup-commit");
        update.request.checkRestart();
        await vi.waitFor(() => {
          expect(fixture.remoteHeadCommit).toHaveBeenCalledOnce();
        });
      },
    });

    await fixture.run();

    expect(fixture.runtimeWirings()[0]).toMatchObject({
      mode: "reviewer",
      relayOrigin: "https://relay.example.test",
      logDirectory: "/runtime-logs",
      engineKind: "claude",
      engineTimeoutMs: 45_000,
      bypassPermissions: true,
      concurrency: 3,
      prFilter: { targetPrs: [7, 8], excludedPrs: [9] },
      githubToken: "github-token",
    });
    expect(fixture.githubClients()).toStrictEqual([
      { repository: "owner/repository", token: "github-token" },
    ]);
    expect(fixture.reviewerCalls()).toStrictEqual([7]);
    expect(fixture.authorCalls()).toStrictEqual([]);
    expect(fixture.coordinated()).toStrictEqual([{ prNumber: 7, endpoint: "head" }]);
    expect(fixture.killEngine).toHaveBeenCalledWith(7);
    expect(fixture.banners()).toStrictEqual([{ mode: "reviewer", prNumber: 7 }]);
    const [prompt] = fixture.prompts();
    expect(prompt).toMatchObject({
      prNumber: 7,
      headBranch: "feature/reviewer",
      baseBranch: "main",
    });
    expect(prompt?.prompt).toContain("/auto-develop-review review");
    expect(prompt?.prompt).toContain("(base: origin/main, head: feature/reviewer)");
    expect(prompt?.prompt).not.toContain("Task:");
    expect(fixture.directories()).toHaveLength(2);
    expect(fixture.writtenContexts()[0]?.path).toContain(
      "/worktrees/pr-7/.repo-workflow/auto-develop/run-context/reviewer-7-2026-08-13T00-00-00-000Z/run-context.json",
    );
    expect(fixture.worktreeIsStale.mock.calls.map(([{ branch }]) => branch)).toStrictEqual([
      "pr-7",
      "pr-8",
    ]);
    const reclaimed = fixture.logger.info.mock.calls.find(
      ([, message]) => message === "worktree is idle and can be reclaimed",
    );
    expect(String(reclaimed?.[0].worktreePath)).toContain("pr-8");
    expect(fixture.logger.warn).toHaveBeenCalledWith(
      { reason: "idle" },
      "restart requested; disconnecting without draining",
    );
    expect(
      fixture.logger.info.mock.calls.filter(([fields]) => fields.statusBar === true),
    ).toHaveLength(6);
    expect(fixture.disconnect).toHaveBeenCalledOnce();
    for (const scheduler of fixture.schedulers()) {
      expect(scheduler.start).toHaveBeenCalledOnce();
      expect(scheduler.stop).toHaveBeenCalledOnce();
    }
    expect(fixture.schedulers()[1]?.request.restartCheckIntervalMs).toBe(900_000);
    expect(fixture.cycles()).toHaveLength(1);
    expect(fixture.logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "reviewer", engine: "claude", ghUserSource: "override" }),
      "runtime starting",
    );
  });

  test("wires author jobs, code-update restart and scheduler cleanup after failure", async () => {
    const cycleFailure = new Error("cycle failed");
    const fixture = scenarioFixture({
      mode: "author",
      engineCommand: "custom-engine --headless",
      duringCycle: async ({ cycle, handlers, schedulers, setRemoteCommit }) => {
        await prEventHandler(handlers)({ pullNumber: "invalid" });
        await prEventHandler(handlers)({ pullNumber: 8 });
        cycle.baseline.set("commit", "startup-commit");
        setRemoteCommit("updated-commit");
        statusAndUpdateSchedulers(schedulers).update.request.checkRestart();
        await vi.waitFor(() => {
          expect(fixture.disconnect).toHaveBeenCalledOnce();
        });
        throw cycleFailure;
      },
    });

    await expect(fixture.run()).rejects.toBe(cycleFailure);

    expect(fixture.runtimeWirings()[0]).toMatchObject({
      mode: "author",
      engineOverride: "custom-engine --headless",
    });
    expect(fixture.reviewerCalls()).toStrictEqual([]);
    expect(fixture.authorCalls()).toStrictEqual([
      { prNumber: 0, reason: "request_changes" },
      { prNumber: 8, reason: "request_changes" },
    ]);
    expect(fixture.banners()).toStrictEqual([
      { mode: "author", prNumber: 0 },
      { mode: "author", prNumber: 8 },
    ]);
    const [prompt] = fixture.prompts();
    expect(prompt).toMatchObject({
      prNumber: 8,
      headBranch: "feature/author",
    });
    expect(prompt?.baseBranch).toBeUndefined();
    expect(prompt?.prompt).toContain("/auto-develop-fix");
    expect(prompt?.prompt).toContain("(base: feature/author, head: feature/author)");
    expect(prompt?.prompt).toContain("Task: request_changes");
    expect(fixture.logger.info).toHaveBeenCalledWith(
      { startupCommit: "startup-commit", currentCommit: "updated-commit" },
      "code update detected on the tracked remote branch",
    );
    expect(fixture.logger.warn).toHaveBeenCalledWith(
      { reason: "code-updated" },
      "restart requested; disconnecting without draining",
    );
    for (const scheduler of fixture.schedulers()) expect(scheduler.stop).toHaveBeenCalledOnce();
  });
});
