import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger, type Logger } from "../logging/logger.ts";
import { composeRuntime, type RuntimeWiring } from "./compose-runtime.ts";

import type { CommandExecutor, TailFs } from "../engine/command-executor.ts";
import type { TmuxRunRequest } from "../engine/tmux-runner.ts";
import type { JobQueue } from "../queue/job-queue.ts";
import type { SseTransport, SseTransportConfig } from "../transport/sse-transport.ts";
import type { GitOperations } from "../worktree/git-operations.ts";
import type { GitRunner } from "../worktree/git-runner.ts";
import type { WorktreeFs } from "../worktree/worktree-fs.ts";

type ComposeRuntimeDependencies = Required<NonNullable<Parameters<typeof composeRuntime>[1]>>;

const wiringWith = (overrides: Partial<RuntimeWiring> = {}): RuntimeWiring => ({
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
  ...overrides,
});

const settled = async (task: () => Promise<unknown>): Promise<unknown> => {
  try {
    return await task();
  } catch (taskFailure) {
    return taskFailure;
  }
};

const fixture = (setup: {
  readonly branch?: string | null;
  readonly gitResponses?: readonly ({ readonly stdout: string } | Error)[];
  readonly fetchStatus?: number;
  readonly fetchBody?: unknown;
  readonly engineOverride?: string;
  readonly markerMtimeMs?: number | null;
  readonly useDefaultTime?: boolean;
}) => {
  const gitResponses = new Map(
    (setup.gitResponses ?? []).map((response, index) => [index, response]),
  );
  const gitIndex = new Map([["next", 0]]);
  const gitRun = vi.fn<GitRunner["run"]>(() => {
    const index = gitIndex.get("next") ?? 0;
    gitIndex.set("next", index + 1);
    const response = gitResponses.get(index) ?? { stdout: "" };
    return response instanceof Error
      ? Promise.reject(response)
      : Promise.resolve({ ...response, stderr: "" });
  });
  const git: GitRunner = { run: gitRun };
  const commandRun = vi.fn<CommandExecutor["run"]>(() =>
    Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }),
  );
  const commandExecutor: CommandExecutor = { run: commandRun };
  const tailFs: TailFs = {
    makeTempDir: () => "/tail",
    appendTarget: () => undefined,
    readFrom: () => "",
    readExitCode: () => 0,
    readAll: () => "",
    removeRecursive: () => undefined,
  };
  const tmuxConfig = new Map<string, Parameters<ComposeRuntimeDependencies["runInTmux"]>[0]>();
  const tmuxRequests = new Map<string, TmuxRunRequest>();
  const transportConfig = new Map<string, SseTransportConfig>();
  const connect = vi.fn<SseTransport["connect"]>(() => Promise.resolve());
  const disconnect = vi.fn<SseTransport["disconnect"]>();
  const transport: SseTransport = {
    connect,
    disconnect,
    events: async function* events() {
      yield { delivery: "event" };
    },
  };
  const queueConfig = new Map<string, Parameters<ComposeRuntimeDependencies["createQueue"]>[0]>();
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
    reserveLane: (_lane, task) => task(),
  };
  const acquireRequests = new Map<
    string,
    Parameters<ComposeRuntimeDependencies["acquireWorktree"]>[0]
  >();
  const setupWorktree = vi.fn<RuntimeWiring["setupWorktree"]>(() => Promise.resolve());
  const markerMtimeMs = vi.fn<WorktreeFs["markerMtimeMs"]>(() =>
    setup.markerMtimeMs === undefined ? 0 : setup.markerMtimeMs,
  );
  const worktreeFs: WorktreeFs = {
    exists: () => true,
    removeRecursive: () => undefined,
    writeMarker: () => undefined,
    markerMtimeMs,
  };
  const fetchCalls = new Map<number, { readonly url: string; readonly init: RequestInit }>();
  const fetchImpl: ComposeRuntimeDependencies["fetch"] = (input, init) => {
    if (typeof input !== "string") throw new Error("expected a string URL");
    fetchCalls.set(fetchCalls.size, { url: input, init: init ?? {} });
    return Promise.resolve(
      Response.json(
        setup.fetchBody ?? {
          token: "relay-token",
          expiresAt: "2026-08-11T08:00:00.000Z",
        },
        { status: setup.fetchStatus ?? 200 },
      ),
    );
  };
  const authorization = new Map<string, string>();
  const startupDrain = vi.fn<ComposeRuntimeDependencies["runStartupDrain"]>(async (config) => {
    authorization.set(
      "header",
      await config.credentials.authorizationFor({ url: `${config.baseUrl}/events/stream` }),
    );
    return [{ drained: true }];
  });
  const logErrors = vi.fn<Logger["error"]>();
  const log: Logger = { ...silentLogger, error: logErrors };
  const logSinkInput = new Map<
    string,
    Parameters<ComposeRuntimeDependencies["createLogFileSink"]>[0]
  >();
  const loggerInput = new Map<
    string,
    {
      readonly name: string;
      readonly options: Parameters<ComposeRuntimeDependencies["createLogger"]>[1];
    }
  >();
  const syncMain = vi.fn<ComposeRuntimeDependencies["syncMain"]>(() => Promise.resolve());
  const operations: GitOperations = {
    hasUncommittedChanges: () => Promise.resolve(false),
    porcelainStatus: () => Promise.resolve(""),
    commitAll: () => Promise.resolve(),
    push: () => Promise.resolve(),
    mergeRemoteBranch: () => Promise.resolve(),
    topLevelPath: () => Promise.resolve("/repo-root"),
    sharedGitDirPath: () => Promise.resolve("/shared-git"),
  };
  const dependencies: Partial<ComposeRuntimeDependencies> = {
    fetch: fetchImpl,
    createLogFileSink: (sink) => {
      logSinkInput.set("input", sink);
      return { append: () => undefined };
    },
    createLogger: (name, options) => {
      loggerInput.set("input", { name, options });
      return log;
    },
    createGit: () => git,
    createCommandExecutor: () => commandExecutor,
    createTailFs: () => tailFs,
    runInTmux: (config) => {
      tmuxConfig.set("input", config);
      return async function* run(request) {
        tmuxRequests.set("input", request);
        yield "tmux output";
      };
    },
    createQueue: (config) => {
      queueConfig.set("input", config);
      return queue;
    },
    createTransport: (config) => {
      transportConfig.set("input", config);
      return transport;
    },
    acquireWorktree: (request) => {
      acquireRequests.set("input", request);
      return Promise.resolve("/worktree");
    },
    createWorktreeFs: () => worktreeFs,
    syncMain,
    resolveDefaultBranch: () => Promise.resolve(setup.branch === undefined ? "main" : setup.branch),
    createGitOperations: () => operations,
    runStartupDrain: startupDrain,
    ...(setup.useDefaultTime === true
      ? {}
      : {
          now: () => Date.parse("2026-08-15T00:00:00.000Z"),
          nowDate: () => new Date("2026-08-11T00:00:00.000Z"),
          sleep: () => Promise.resolve(),
        }),
  };
  const runtime = composeRuntime(
    wiringWith({
      setupWorktree,
      ...(setup.engineOverride === undefined ? {} : { engineOverride: setup.engineOverride }),
    }),
    dependencies,
  );
  return {
    runtime,
    queue,
    log,
    tmuxConfig,
    tmuxRequests,
    transportConfig,
    queueConfig,
    acquireRequests,
    setupWorktree,
    logSinkInput,
    loggerInput,
    fetchCalls,
    fetchImpl,
    authorization,
    startupDrain,
    syncMain,
    connect,
    disconnect,
    gitRun,
    markerMtimeMs,
    logErrors,
    commandRun,
  };
};

describe("composeRuntime", () => {
  test("wires the named logger, queue, transport and orchestrator", () => {
    const setup = fixture({});

    expect(setup.runtime.log).toBe(setup.log);
    expect(setup.runtime.queue).toBe(setup.queue);
    expect(setup.loggerInput.get("input")?.name).toBe("auto-develop-reviewer");
    expect(setup.logSinkInput.get("input")).toMatchObject({
      directory: "/logs",
      name: "auto-develop-reviewer",
    });
    expect(setup.logSinkInput.get("input")?.nowIso()).toBe("2026-08-11T00:00:00.000Z");
    expect(setup.queueConfig.get("input")).toMatchObject({
      concurrency: 2,
      prFilter: { targetPrs: [7], excludedPrs: [9] },
    });
    expect(setup.transportConfig.get("input")).toMatchObject({
      url: "https://relay.example.test/events/stream",
      mode: "reviewer",
    });
    expect(setup.transportConfig.get("input")?.fetchImpl).toBe(setup.fetchImpl);
  });

  test("wires the engine with and without a launch override", async () => {
    const defaultEngine = fixture({});
    const overriddenEngine = fixture({ engineOverride: "wrapper --flag" });
    const defaultPrompt = vi.fn<(worktreePath: string) => Promise<string>>(() =>
      Promise.resolve("default prompt"),
    );
    const overriddenPrompt = vi.fn<(worktreePath: string) => Promise<string>>(() =>
      Promise.resolve("overridden prompt"),
    );

    await defaultEngine.runtime.orchestrator.runInWorktree({
      prNumber: 17,
      headBranch: "feature",
      baseBranch: "main",
      buildPrompt: defaultPrompt,
    });
    await overriddenEngine.runtime.orchestrator.runInWorktree({
      prNumber: 18,
      headBranch: "other-feature",
      buildPrompt: overriddenPrompt,
    });
    expect(defaultEngine.acquireRequests.get("input")).toMatchObject({
      context: { repoDir: "/repository", sharedGitDir: "/repository/.git" },
      request: { prNumber: 17, headBranch: "feature", baseBranch: "main" },
    });
    expect(defaultEngine.setupWorktree).toHaveBeenCalledExactlyOnceWith("/worktree");
    expect(defaultPrompt).toHaveBeenCalledExactlyOnceWith("/worktree");
    expect(defaultEngine.tmuxRequests.get("input")).toMatchObject({
      binary: "codex",
      cwd: "/worktree",
      sessionName: "auto-develop-pr-17",
      timeoutMs: 5000,
    });
    expect(overriddenEngine.tmuxRequests.get("input")).toMatchObject({
      binary: "wrapper",
      cwd: "/worktree",
      sessionName: "auto-develop-pr-18",
      timeoutMs: 5000,
    });
    expect(overriddenEngine.tmuxRequests.get("input")?.args.at(0)).toBe("--flag");
  });

  test("uses production time dependencies when they are not overridden", async () => {
    const setup = fixture({ useDefaultTime: true });

    expect(setup.logSinkInput.get("input")?.nowIso()).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(setup.tmuxConfig.get("input")?.now()).toBeTypeOf("number");
    await expect(setup.tmuxConfig.get("input")?.sleep(0)).resolves.toBeUndefined();
  });

  test("delegates synchronization, startup drain, transport and engine boundaries", async () => {
    const setup = fixture({});

    await setup.runtime.syncToMain();
    expect(setup.syncMain).toHaveBeenCalledOnce();
    expect(setup.syncMain.mock.calls[0]?.[0]).toMatchObject({ startDir: "/repository" });
    await expect(setup.runtime.drainStartup()).resolves.toStrictEqual([{ drained: true }]);
    expect(setup.authorization.get("header")).toBe("Bearer relay-token");
    expect(setup.fetchCalls.get(0)).toStrictEqual({
      url: "https://relay.example.test/auth/session",
      init: { method: "POST", headers: { authorization: "Bearer github-token" } },
    });
    await setup.runtime.connect();
    expect(setup.connect).toHaveBeenCalledOnce();
    const events = await Array.fromAsync(setup.runtime.subscribe());
    expect(events).toStrictEqual([{ delivery: "event" }]);
    setup.runtime.disconnect();
    expect(setup.disconnect).toHaveBeenCalledOnce();
    await setup.runtime.killEngine(17);
    expect(setup.commandRun).toHaveBeenCalledExactlyOnceWith({
      binary: "tmux",
      args: ["kill-session", "-t", "auto-develop-pr-17"],
    });
  });

  test("fails session issuance when the relay rejects it", async () => {
    const setup = fixture({ fetchStatus: 403 });

    const failure = await settled(() => setup.runtime.drainStartup());

    expect(failure).toBeInstanceOf(Error);
    expect(failure).toStrictEqual(new Error("the relay refused the session with status 403"));
  });

  test("returns null when the tracked default branch cannot be resolved", async () => {
    const setup = fixture({ branch: null });

    await expect(setup.runtime.remoteHeadCommit()).resolves.toBeNull();
    expect(setup.gitRun).not.toHaveBeenCalled();
  });

  test("fetches and resolves the remote head commit", async () => {
    const setup = fixture({
      branch: "develop",
      gitResponses: [{ stdout: "" }, { stdout: "abc123\n" }],
    });

    await expect(setup.runtime.remoteHeadCommit()).resolves.toBe("abc123");
    expect(setup.gitRun.mock.calls).toStrictEqual([
      [{ args: ["fetch", "origin", "develop"], cwd: "/repository" }],
      [{ args: ["rev-parse", "origin/develop"], cwd: "/repository" }],
    ]);
  });

  test("logs and returns null when probing the remote head fails", async () => {
    const failure = new Error("network failed");
    const setup = fixture({ branch: "main", gitResponses: [failure] });

    await expect(setup.runtime.remoteHeadCommit()).resolves.toBeNull();
    expect(setup.logErrors).toHaveBeenCalledExactlyOnceWith(
      {
        repoDir: "/repository",
        remote: "origin",
        ref: "origin/main",
        err: failure,
      },
      "could not probe the remote head",
    );
  });

  test("dispatches close and exclusion events into lifecycle state", () => {
    const setup = fixture({});

    expect(setup.runtime.dispatcher.dispatch({ kind: "pr-closed", pullNumber: 7 })).toBe(true);
    expect(setup.runtime.gate.isClosed(7)).toBe(true);
    const excludedSignal = setup.runtime.gate.openSignal(9);
    expect(setup.runtime.dispatcher.dispatch({ kind: "pr-excluded", pullNumber: 9 })).toBe(true);
    expect(excludedSignal.aborted).toBe(true);
  });

  test.each([
    { output: "abc\trefs/heads/topic\n", expected: true },
    { output: "abc\trefs/heads/topic\n", markerMtimeMs: null, expected: false },
    { output: "", markerMtimeMs: 0, expected: true },
  ])("derives worktree staleness from $output and marker $markerMtimeMs", async (scenario) => {
    const setup = fixture({
      gitResponses: [{ stdout: scenario.output }],
      markerMtimeMs: scenario.markerMtimeMs,
    });

    await expect(
      setup.runtime.worktreeIsStale({ worktreePath: "/worktree", branch: "topic" }),
    ).resolves.toBe(scenario.expected);
    expect(setup.gitRun).toHaveBeenCalledExactlyOnceWith({
      args: ["ls-remote", "--heads", "origin", "refs/heads/topic"],
      cwd: "/repository",
    });
    expect(setup.markerMtimeMs).toHaveBeenCalledExactlyOnceWith("/worktree");
  });
});

standardIoTest("reports a log sink failure on stderr", ({ stdout, stderr }) => {
  const setup = fixture({});

  setup.logSinkInput.get("input")?.onFailure(new Error("disk full"));

  expect(stdout.text).toMatchInlineSnapshot(`""`);
  expect(stderr.text).toMatchInlineSnapshot(`
    "could not append to the log file: Error: disk full
    "
  `);
});
