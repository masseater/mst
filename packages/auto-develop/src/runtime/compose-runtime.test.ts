import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger, type Logger } from "../logging/logger.ts";
import { composeRuntime } from "./compose-runtime.ts";

import type { CommandExecutor, TailFs } from "../engine/command-executor.ts";
import type { JobQueue } from "../queue/job-queue.ts";
import type { SseTransport } from "../transport/sse-transport.ts";
import type { GitOperations } from "../worktree/git-operations.ts";
import type { GitRunner } from "../worktree/git-runner.ts";
import type { WorktreeFs } from "../worktree/worktree-fs.ts";

type ComposeRuntimeDependencies = Required<NonNullable<Parameters<typeof composeRuntime>[1]>>;

describe("composeRuntime wiring", () => {
  const it = test.extend("wiringObservation", () => {
    const wiringObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
    const queue: JobQueue = {
      enqueue: () => true,
      enqueueFollowUp: () => true,
      setHandlers: () => undefined,
      runningLanes: () => [],
      waitingLanes: () => [],
      size: () => ({ waiting: 0, running: 0 }),
      isIdle: () => true,
      admitsLane: () => true,
      cancelLane: () => 0,
      drain: () => Promise.resolve(),
      reserveLane: (_lane, reservedTask) => reservedTask(),
    };
    const transport: SseTransport = {
      connect: () => Promise.resolve(),
      disconnect: () => undefined,
      events: async function* events() {
        await Promise.resolve();
        yield* [];
      },
    };
    const relayFetch = vi.fn<typeof fetch>();
    const runtime = composeRuntime(
      {
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repoDir: "/repository",
        logDirectory: "/logs",
        engineKind: "codex",
        engineTimeoutMs: 5000,
        bypassPermissions: false,
        concurrency: 2,
        prFilter: { targetPrs: [7], excludedPrs: [9] },
        githubToken: "github-token",
        setupWorktree: () => Promise.resolve(),
      },
      {
        fetch: relayFetch,
        nowDate: () => new Date("2026-08-11T00:00:00.000Z"),
        createLogFileSink: (sinkDescription) => {
          wiringObservation("log sink identity", {
            directory: sinkDescription.directory,
            name: sinkDescription.name,
          });
          wiringObservation("log sink timestamp", sinkDescription.nowIso());
          return { append: () => undefined };
        },
        createLogger: (loggerName) => {
          wiringObservation("logger name", loggerName);
          return silentLogger;
        },
        createQueue: (queueConfiguration) => {
          wiringObservation("queue configuration", {
            concurrency: queueConfiguration.concurrency,
            prFilter: queueConfiguration.prFilter,
          });
          return queue;
        },
        createTransport: (transportConfiguration) => {
          wiringObservation("transport configuration", {
            url: transportConfiguration.url,
            mode: transportConfiguration.mode,
          });
          wiringObservation(
            "transport fetch identity",
            transportConfiguration.fetchImpl === relayFetch,
          );
          return transport;
        },
      },
    );
    wiringObservation("runtime logger identity", runtime.log === silentLogger);
    wiringObservation("runtime queue identity", runtime.queue === queue);
    return wiringObservation;
  });

  it("returns the logger created for the runtime", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith("runtime logger identity", true);
  });

  it("returns the queue created for the runtime", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith("runtime queue identity", true);
  });

  it("names the reviewer logger", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith("logger name", "auto-develop-reviewer");
  });

  it("locates the reviewer log sink", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith("log sink identity", {
      directory: "/logs",
      name: "auto-develop-reviewer",
    });
  });

  it("uses the injected date for log entries", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith(
      "log sink timestamp",
      "2026-08-11T00:00:00.000Z",
    );
  });

  it("passes concurrency and pull request filters to the queue", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith("queue configuration", {
      concurrency: 2,
      prFilter: { targetPrs: [7], excludedPrs: [9] },
    });
  });

  it("passes the relay endpoint and mode to the transport", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith("transport configuration", {
      url: "https://relay.example.test/events/stream",
      mode: "reviewer",
    });
  });

  it("shares the injected fetch implementation with the transport", ({ wiringObservation }) => {
    expect(wiringObservation).toHaveBeenCalledWith("transport fetch identity", true);
  });
});

describe("composeRuntime engine wiring", () => {
  const it = test.extend("engineObservation", async () => {
    const engineObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
    const git: GitRunner = {
      run: () => Promise.resolve({ stdout: "", stderr: "" }),
    };
    const operations: GitOperations = {
      hasUncommittedChanges: () => Promise.resolve(false),
      porcelainStatus: () => Promise.resolve(""),
      commitAll: () => Promise.resolve(),
      push: () => Promise.resolve(),
      mergeRemoteBranch: () => Promise.resolve(),
      topLevelPath: () => Promise.resolve("/repo-root"),
      sharedGitDirPath: () => Promise.resolve("/shared-git"),
    };
    const engineDependencies: Partial<ComposeRuntimeDependencies> = {
      createLogger: () => silentLogger,
      createGit: () => git,
      createGitOperations: () => operations,
      acquireWorktree: (acquisition) => {
        engineObservation("default acquisition", {
          context: {
            repoDir: acquisition.context.repoDir,
            sharedGitDir: acquisition.context.sharedGitDir,
          },
          request: acquisition.request,
        });
        return Promise.resolve("/worktree");
      },
      runInTmux: () =>
        async function* run(tmuxInvocation) {
          engineObservation("default tmux invocation", {
            binary: tmuxInvocation.binary,
            cwd: tmuxInvocation.cwd,
            sessionName: tmuxInvocation.sessionName,
            timeoutMs: tmuxInvocation.timeoutMs,
          });
          yield "tmux output";
        },
    };
    const defaultRuntime = composeRuntime(
      {
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repoDir: "/repository",
        logDirectory: "/logs",
        engineKind: "codex",
        engineTimeoutMs: 5000,
        bypassPermissions: false,
        concurrency: 2,
        prFilter: { targetPrs: [7], excludedPrs: [9] },
        githubToken: "github-token",
        setupWorktree: (worktreePath) => {
          engineObservation("default worktree setup", worktreePath);
          return Promise.resolve();
        },
      },
      engineDependencies,
    );
    await defaultRuntime.orchestrator.runInWorktree({
      prNumber: 17,
      headBranch: "feature",
      baseBranch: "main",
      buildPrompt: (worktreePath) => {
        engineObservation("default prompt", worktreePath);
        return Promise.resolve("default prompt");
      },
    });

    const overriddenRuntime = composeRuntime(
      {
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repoDir: "/repository",
        logDirectory: "/logs",
        engineKind: "codex",
        engineOverride: "wrapper --flag",
        engineTimeoutMs: 5000,
        bypassPermissions: false,
        concurrency: 2,
        prFilter: { targetPrs: [7], excludedPrs: [9] },
        githubToken: "github-token",
        setupWorktree: () => Promise.resolve(),
      },
      {
        ...engineDependencies,
        acquireWorktree: () => Promise.resolve("/worktree"),
        runInTmux: () =>
          async function* run(tmuxInvocation) {
            engineObservation("overridden tmux invocation", {
              binary: tmuxInvocation.binary,
              prefixArgument: tmuxInvocation.args.at(0),
              cwd: tmuxInvocation.cwd,
              sessionName: tmuxInvocation.sessionName,
              timeoutMs: tmuxInvocation.timeoutMs,
            });
            yield "tmux output";
          },
      },
    );
    await overriddenRuntime.orchestrator.runInWorktree({
      prNumber: 18,
      headBranch: "other-feature",
      buildPrompt: () => Promise.resolve("overridden prompt"),
    });
    return engineObservation;
  });

  it("passes repository context and the pull request to worktree acquisition", ({
    engineObservation,
  }) => {
    expect(engineObservation).toHaveBeenCalledWith("default acquisition", {
      context: { repoDir: "/repository", sharedGitDir: "/repository/.git" },
      request: { prNumber: 17, headBranch: "feature", baseBranch: "main" },
    });
  });

  it("sets up the acquired worktree", ({ engineObservation }) => {
    expect(engineObservation).toHaveBeenCalledWith("default worktree setup", "/worktree");
  });

  it("builds the prompt in the acquired worktree", ({ engineObservation }) => {
    expect(engineObservation).toHaveBeenCalledWith("default prompt", "/worktree");
  });

  it("starts the default engine in its pull request session", ({ engineObservation }) => {
    expect(engineObservation).toHaveBeenCalledWith("default tmux invocation", {
      binary: "codex",
      cwd: "/worktree",
      sessionName: "auto-develop-pr-17",
      timeoutMs: 5000,
    });
  });

  it("prefixes an overridden engine invocation", ({ engineObservation }) => {
    expect(engineObservation).toHaveBeenCalledWith("overridden tmux invocation", {
      binary: "wrapper",
      prefixArgument: "--flag",
      cwd: "/worktree",
      sessionName: "auto-develop-pr-18",
      timeoutMs: 5000,
    });
  });
});

describe("composeRuntime production time dependencies", () => {
  const it = test.extend("timeObservation", async () => {
    const timeObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
    const productionSleep = vi.fn<() => Promise<void>>();
    composeRuntime(
      {
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repoDir: "/repository",
        logDirectory: "/logs",
        engineKind: "codex",
        engineTimeoutMs: 5000,
        bypassPermissions: false,
        concurrency: 2,
        prFilter: { targetPrs: [7], excludedPrs: [9] },
        githubToken: "github-token",
        setupWorktree: () => Promise.resolve(),
      },
      {
        createLogger: () => silentLogger,
        createLogFileSink: (sinkDescription) => {
          const isoTimestamp = sinkDescription.nowIso();
          timeObservation("ISO timestamp", new Date(isoTimestamp).toISOString() === isoTimestamp);
          return { append: () => undefined };
        },
        runInTmux: (tmuxConfiguration) => {
          timeObservation("finite current time", Number.isFinite(tmuxConfiguration.now()));
          productionSleep.mockReturnValue(tmuxConfiguration.sleep(0));
          return async function* run() {
            await Promise.resolve();
            yield* [];
          };
        },
      },
    );
    await productionSleep();
    timeObservation("completed sleep", true);
    return timeObservation;
  });

  it("provides an ISO timestamp to the log sink", ({ timeObservation }) => {
    expect(timeObservation).toHaveBeenCalledWith("ISO timestamp", true);
  });

  it("provides a finite current time to the engine", ({ timeObservation }) => {
    expect(timeObservation).toHaveBeenCalledWith("finite current time", true);
  });

  it("provides a working sleep implementation to the engine", ({ timeObservation }) => {
    expect(timeObservation).toHaveBeenCalledWith("completed sleep", true);
  });
});

describe("composeRuntime delegated boundaries", () => {
  const it = test.extend("boundaryObservation", async () => {
    const boundaryObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
    const commandExecutor: CommandExecutor = {
      run: (commandInvocation) => {
        boundaryObservation("engine kill", commandInvocation);
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      },
    };
    const tailFs: TailFs = {
      makeTempDir: () => "/tail",
      appendTarget: () => undefined,
      readFrom: () => "",
      readExitCode: () => 0,
      readAll: () => "",
      removeRecursive: () => undefined,
    };
    const transport: SseTransport = {
      connect: () => {
        boundaryObservation("transport connect", true);
        return Promise.resolve();
      },
      disconnect: () => {
        boundaryObservation("transport disconnect", true);
      },
      events: async function* events() {
        await Promise.resolve();
        yield { delivery: "event" };
      },
    };
    const relayFetch: typeof fetch = (relayResource, relayInitialization) => {
      boundaryObservation("session request", {
        resource: relayResource,
        initialization: relayInitialization,
      });
      return Promise.resolve(
        Response.json({
          token: "relay-token",
          expiresAt: "2026-08-11T08:00:00.000Z",
        }),
      );
    };
    const runtime = composeRuntime(
      {
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repoDir: "/repository",
        logDirectory: "/logs",
        engineKind: "codex",
        engineTimeoutMs: 5000,
        bypassPermissions: false,
        concurrency: 2,
        prFilter: { targetPrs: [7], excludedPrs: [9] },
        githubToken: "github-token",
        setupWorktree: () => Promise.resolve(),
      },
      {
        fetch: relayFetch,
        createLogger: () => silentLogger,
        createCommandExecutor: () => commandExecutor,
        createTailFs: () => tailFs,
        runInTmux: () =>
          async function* run() {
            await Promise.resolve();
            yield* [];
          },
        syncMain: (synchronization) => {
          boundaryObservation("main synchronization", synchronization.startDir);
          return Promise.resolve();
        },
        runStartupDrain: async (drainConfiguration) => {
          boundaryObservation(
            "startup authorization",
            await drainConfiguration.credentials.authorizationFor({
              url: `${drainConfiguration.baseUrl}/events/stream`,
            }),
          );
          return [{ drained: true }];
        },
        createTransport: () => transport,
      },
    );
    await runtime.syncToMain();
    boundaryObservation("startup drain", await runtime.drainStartup());
    await runtime.connect();
    boundaryObservation("subscribed deliveries", await Array.fromAsync(runtime.subscribe()));
    runtime.disconnect();
    await runtime.killEngine(17);
    return boundaryObservation;
  });

  it("delegates main synchronization from the repository directory", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("main synchronization", "/repository");
  });

  it("returns the startup drain result", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("startup drain", [{ drained: true }]);
  });

  it("authorizes startup drain with the issued relay token", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("startup authorization", "Bearer relay-token");
  });

  it("requests a relay session with the GitHub token", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("session request", {
      resource: "https://relay.example.test/auth/session",
      initialization: {
        method: "POST",
        headers: { authorization: "Bearer github-token" },
      },
    });
  });

  it("connects the transport", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("transport connect", true);
  });

  it("returns subscribed deliveries", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("subscribed deliveries", [
      { delivery: "event" },
    ]);
  });

  it("disconnects the transport", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("transport disconnect", true);
  });

  it("kills the pull request engine session", ({ boundaryObservation }) => {
    expect(boundaryObservation).toHaveBeenCalledWith("engine kill", {
      binary: "tmux",
      args: ["kill-session", "-t", "auto-develop-pr-17"],
    });
  });
});

describe("composeRuntime relay session rejection", () => {
  const it = test.extend("relaySessionRejection", async () => {
    const runtime = composeRuntime(
      {
        mode: "reviewer",
        relayOrigin: "https://relay.example.test",
        repoDir: "/repository",
        logDirectory: "/logs",
        engineKind: "codex",
        engineTimeoutMs: 5000,
        bypassPermissions: false,
        concurrency: 2,
        prFilter: { targetPrs: [7], excludedPrs: [9] },
        githubToken: "github-token",
        setupWorktree: () => Promise.resolve(),
      },
      {
        createLogger: () => silentLogger,
        fetch: () => Promise.resolve(new Response(null, { status: 403 })),
      },
    );
    try {
      return await runtime.drainStartup();
    } catch (relaySessionRejection) {
      return relaySessionRejection;
    }
  });

  it("fails when the relay refuses session issuance", ({ relaySessionRejection }) => {
    expect(relaySessionRejection).toStrictEqual(
      new Error("the relay refused the session with status 403"),
    );
  });
});

describe("composeRuntime remote head probing", () => {
  const it = test
    .extend("absentBranchObservation", async () => {
      const absentBranchObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => silentLogger,
          createGit: () => ({
            run: (gitInvocation) => {
              absentBranchObservation("unexpected git invocation", gitInvocation);
              return Promise.resolve({ stdout: "", stderr: "" });
            },
          }),
          resolveDefaultBranch: () => Promise.resolve(null),
        },
      );
      absentBranchObservation("remote head", await runtime.remoteHeadCommit());
      return absentBranchObservation;
    })
    .extend("resolvedBranchObservation", async () => {
      const resolvedBranchObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => silentLogger,
          createGit: () => ({
            run: (gitInvocation) => {
              resolvedBranchObservation("git invocation", gitInvocation);
              return Promise.resolve({
                stdout: gitInvocation.args[0] === "fetch" ? "" : "abc123\n",
                stderr: "",
              });
            },
          }),
          resolveDefaultBranch: () => Promise.resolve("develop"),
        },
      );
      resolvedBranchObservation("remote head", await runtime.remoteHeadCommit());
      return resolvedBranchObservation;
    })
    .extend("failedProbeObservation", async () => {
      const failedProbeObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
      const probeFailure = new Error("network failed");
      const probeLogger: Logger = {
        ...silentLogger,
        error: (logFields, logMessage) => {
          failedProbeObservation("probe log", { logFields, logMessage });
        },
      };
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => probeLogger,
          createGit: () => ({ run: () => Promise.reject(probeFailure) }),
          resolveDefaultBranch: () => Promise.resolve("main"),
        },
      );
      failedProbeObservation("remote head", await runtime.remoteHeadCommit());
      return failedProbeObservation;
    });

  it("returns null without invoking Git when no default branch exists", ({
    absentBranchObservation,
  }) => {
    expect(absentBranchObservation).toHaveBeenCalledExactlyOnceWith("remote head", null);
  });

  it("fetches the tracked default branch", ({ resolvedBranchObservation }) => {
    expect(resolvedBranchObservation).toHaveBeenNthCalledWith(1, "git invocation", {
      args: ["fetch", "origin", "develop"],
      cwd: "/repository",
    });
  });

  it("resolves the tracked remote branch", ({ resolvedBranchObservation }) => {
    expect(resolvedBranchObservation).toHaveBeenNthCalledWith(2, "git invocation", {
      args: ["rev-parse", "origin/develop"],
      cwd: "/repository",
    });
  });

  it("returns the trimmed remote head revision", ({ resolvedBranchObservation }) => {
    expect(resolvedBranchObservation).toHaveBeenNthCalledWith(3, "remote head", "abc123");
  });

  it("returns null when remote head probing fails", ({ failedProbeObservation }) => {
    expect(failedProbeObservation).toHaveBeenCalledWith("remote head", null);
  });

  it("logs the failed remote head probe", ({ failedProbeObservation }) => {
    expect(failedProbeObservation).toHaveBeenCalledWith("probe log", {
      logFields: {
        repoDir: "/repository",
        remote: "origin",
        ref: "origin/main",
        err: new Error("network failed"),
      },
      logMessage: "could not probe the remote head",
    });
  });
});

describe("composeRuntime lifecycle dispatch", () => {
  const it = test
    .extend("closedDispatchVerdict", () =>
      composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        { createLogger: () => silentLogger },
      ).dispatcher.dispatch({ kind: "pr-closed", pullNumber: 7 }))
    .extend("closedGateState", () => {
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        { createLogger: () => silentLogger },
      );
      runtime.dispatcher.dispatch({ kind: "pr-closed", pullNumber: 7 });
      return runtime.gate.isClosed(7);
    })
    .extend("excludedDispatchVerdict", () =>
      composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        { createLogger: () => silentLogger },
      ).dispatcher.dispatch({ kind: "pr-excluded", pullNumber: 9 }),
    )
    .extend("excludedAbort", () => {
      const excludedAbort = vi.fn<() => void>();
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        { createLogger: () => silentLogger },
      );
      runtime.gate.openSignal(9).addEventListener("abort", excludedAbort);
      runtime.dispatcher.dispatch({ kind: "pr-excluded", pullNumber: 9 });
      return excludedAbort;
    });

  it("accepts a close event", ({ closedDispatchVerdict }) => {
    expect(closedDispatchVerdict).toBe(true);
  });

  it("closes the lifecycle gate after a close event", ({ closedGateState }) => {
    expect(closedGateState).toBe(true);
  });

  it("accepts an exclusion event", ({ excludedDispatchVerdict }) => {
    expect(excludedDispatchVerdict).toBe(true);
  });

  it("aborts the open signal after an exclusion event", ({ excludedAbort }) => {
    expect(excludedAbort).toHaveBeenCalledOnce();
  });
});

describe("composeRuntime worktree staleness", () => {
  const it = test
    .extend("presentBranchObservation", async () => {
      const presentBranchObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
      const worktreeFs: WorktreeFs = {
        exists: () => true,
        removeRecursive: () => undefined,
        writeMarker: () => undefined,
        markerMtimeMs: (worktreePath) => {
          presentBranchObservation("marker path", worktreePath);
          return 0;
        },
      };
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => silentLogger,
          createGit: () => ({
            run: (gitInvocation) => {
              presentBranchObservation("git invocation", gitInvocation);
              return Promise.resolve({
                stdout: "abc\trefs/heads/topic\n",
                stderr: "",
              });
            },
          }),
          createWorktreeFs: () => worktreeFs,
          now: () => Date.parse("2026-08-15T00:00:00.000Z"),
        },
      );
      presentBranchObservation(
        "staleness",
        await runtime.worktreeIsStale({ worktreePath: "/worktree", branch: "topic" }),
      );
      return presentBranchObservation;
    })
    .extend("untrackedMarkerObservation", async () => {
      const untrackedMarkerObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
      const worktreeFs: WorktreeFs = {
        exists: () => true,
        removeRecursive: () => undefined,
        writeMarker: () => undefined,
        markerMtimeMs: (worktreePath) => {
          untrackedMarkerObservation("marker path", worktreePath);
          return null;
        },
      };
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => silentLogger,
          createGit: () => ({
            run: (gitInvocation) => {
              untrackedMarkerObservation("git invocation", gitInvocation);
              return Promise.resolve({
                stdout: "abc\trefs/heads/topic\n",
                stderr: "",
              });
            },
          }),
          createWorktreeFs: () => worktreeFs,
          now: () => Date.parse("2026-08-15T00:00:00.000Z"),
        },
      );
      untrackedMarkerObservation(
        "staleness",
        await runtime.worktreeIsStale({ worktreePath: "/worktree", branch: "topic" }),
      );
      return untrackedMarkerObservation;
    })
    .extend("missingBranchObservation", async () => {
      const missingBranchObservation = vi.fn<(aspect: string, evidence: unknown) => void>();
      const worktreeFs: WorktreeFs = {
        exists: () => true,
        removeRecursive: () => undefined,
        writeMarker: () => undefined,
        markerMtimeMs: (worktreePath) => {
          missingBranchObservation("marker path", worktreePath);
          return 0;
        },
      };
      const runtime = composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => silentLogger,
          createGit: () => ({
            run: (gitInvocation) => {
              missingBranchObservation("git invocation", gitInvocation);
              return Promise.resolve({ stdout: "", stderr: "" });
            },
          }),
          createWorktreeFs: () => worktreeFs,
          now: () => Date.parse("2026-08-15T00:00:00.000Z"),
        },
      );
      missingBranchObservation(
        "staleness",
        await runtime.worktreeIsStale({ worktreePath: "/worktree", branch: "topic" }),
      );
      return missingBranchObservation;
    });

  it("reclaims an old worktree for a present remote branch", ({ presentBranchObservation }) => {
    expect(presentBranchObservation).toHaveBeenCalledWith("staleness", true);
  });

  it("queries the target remote branch before reclaiming", ({ presentBranchObservation }) => {
    expect(presentBranchObservation).toHaveBeenCalledWith("git invocation", {
      args: ["ls-remote", "--heads", "origin", "refs/heads/topic"],
      cwd: "/repository",
    });
  });

  it("reads the worktree marker before reclaiming", ({ presentBranchObservation }) => {
    expect(presentBranchObservation).toHaveBeenCalledWith("marker path", "/worktree");
  });

  it("keeps an untracked worktree marker", ({ untrackedMarkerObservation }) => {
    expect(untrackedMarkerObservation).toHaveBeenCalledWith("staleness", false);
  });

  it("queries the remote branch for an untracked marker", ({ untrackedMarkerObservation }) => {
    expect(untrackedMarkerObservation).toHaveBeenCalledWith("git invocation", {
      args: ["ls-remote", "--heads", "origin", "refs/heads/topic"],
      cwd: "/repository",
    });
  });

  it("reads an untracked worktree marker", ({ untrackedMarkerObservation }) => {
    expect(untrackedMarkerObservation).toHaveBeenCalledWith("marker path", "/worktree");
  });

  it("reclaims a worktree for a missing remote branch", ({ missingBranchObservation }) => {
    expect(missingBranchObservation).toHaveBeenCalledWith("staleness", true);
  });

  it("queries a missing remote branch before reclaiming", ({ missingBranchObservation }) => {
    expect(missingBranchObservation).toHaveBeenCalledWith("git invocation", {
      args: ["ls-remote", "--heads", "origin", "refs/heads/topic"],
      cwd: "/repository",
    });
  });

  it("reads the worktree marker for a missing branch", ({ missingBranchObservation }) => {
    expect(missingBranchObservation).toHaveBeenCalledWith("marker path", "/worktree");
  });
});

describe("composeRuntime log sink failure", () => {
  const it = standardIoTest
    .extend("logSinkFailureStandardOutput", ({ stdout }) => {
      composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => silentLogger,
          createLogFileSink: (sinkDescription) => {
            sinkDescription.onFailure(new Error("disk full"));
            return { append: () => undefined };
          },
        },
      );
      return stdout.text();
    })
    .extend("logSinkFailureStandardError", ({ stderr }) => {
      composeRuntime(
        {
          mode: "reviewer",
          relayOrigin: "https://relay.example.test",
          repoDir: "/repository",
          logDirectory: "/logs",
          engineKind: "codex",
          engineTimeoutMs: 5000,
          bypassPermissions: false,
          concurrency: 2,
          prFilter: { targetPrs: [7], excludedPrs: [9] },
          githubToken: "github-token",
          setupWorktree: () => Promise.resolve(),
        },
        {
          createLogger: () => silentLogger,
          createLogFileSink: (sinkDescription) => {
            sinkDescription.onFailure(new Error("disk full"));
            return { append: () => undefined };
          },
        },
      );
      return stderr.text();
    });

  it("does not write a log sink failure to stdout", ({ logSinkFailureStandardOutput }) => {
    expect(logSinkFailureStandardOutput).toMatchInlineSnapshot(`""`);
  });

  it("writes a log sink failure to stderr", ({ logSinkFailureStandardError }) => {
    expect(logSinkFailureStandardError).toMatchInlineSnapshot(`
      "could not append to the log file: Error: disk full
      "
    `);
  });
});
