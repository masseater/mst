import { spawnSync } from "node:child_process";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runRelayServerModule } from "./relay-server.ts";
import { IdTokenRejectionError } from "./relay/id-token-rejection-error.ts";

import type { RelayServerRuntime } from "./relay-server-runtime.ts";
import type { GithubReader } from "./relay/github-reader.ts";
import type { RelayDependencies } from "./relay/routes.ts";
import type { ShutdownSignal, SignalTarget } from "./runtime/shutdown.ts";

type RunningRelayServer = NonNullable<ReturnType<typeof runRelayServerModule>>;

const serverPath = fileURLToPath(new URL("./server.ts", import.meta.url));

const requiredEnvironment = {
  GITHUB_REPOSITORY: "example/repository",
  GITHUB_WEBHOOK_SECRET: "webhook-secret",
  PORT: "43123",
  AUTO_DEVELOP_LOG_DIR: "/relay-logs",
};

const githubReader: GithubReader = {
  resolveTokenLogin: () => Promise.resolve("operator"),
  readRepositoryPrivacy: () => Promise.resolve(false),
  listOpenPullRequests: () => Promise.resolve([]),
  resolvePullAuthor: () => Promise.resolve(null),
  listCheckBuckets: () => Promise.resolve([]),
};

const recordingStream = (): {
  readonly stream: Writable;
  readonly text: () => string;
} => {
  const writes = new Map<number, string>();
  const stream = new Writable({
    write: (...call: [unknown, BufferEncoding, (error?: Error | null) => void]) => {
      const [chunk, , callback] = call;
      writes.set(writes.size, String(chunk));
      callback();
    },
  });
  return { stream, text: () => [...writes.values()].join("") };
};

const recordingSignals = (): {
  readonly target: SignalTarget;
  readonly fire: (signal: ShutdownSignal) => void;
  readonly listenerCount: () => number;
} => {
  const listeners = new Map<ShutdownSignal, Set<() => void>>();
  return {
    target: {
      on: (signal, listener) => {
        const signalListeners = listeners.get(signal) ?? new Set<() => void>();
        signalListeners.add(listener);
        listeners.set(signal, signalListeners);
      },
      off: (signal, listener) => {
        listeners.get(signal)?.delete(listener);
      },
    },
    fire: (signal) => {
      for (const listener of listeners.get(signal) ?? []) listener();
    },
    listenerCount: () =>
      [...listeners.values()].reduce((total, signalListeners) => total + signalListeners.size, 0),
  };
};

const runtimeFixture = (
  options: {
    readonly environment?: Readonly<Record<string, unknown>>;
    readonly createLogFileSink?: RelayServerRuntime["createLogFileSink"];
    readonly listen?: (port: number, onListening: () => void) => unknown;
    readonly shutdown?: () => Promise<void>;
  } = {},
) => {
  const stdout = recordingStream();
  const stderr = recordingStream();
  const signals = recordingSignals();
  const githubTokens = new Map<number, string>();
  const relayDependencies = new Map<number, RelayDependencies>();
  const listenedPorts = new Map<number, number>();
  const serverErrorListeners = new Set<(failure: Error) => void>();
  const shutdown = vi.fn<() => Promise<void>>(options.shutdown ?? (() => Promise.resolve()));
  const exited = Promise.withResolvers<number>();
  const exit = vi.fn<(code: number) => void>((code) => {
    exited.resolve(code);
  });
  const createGithubReader = vi.fn<RelayServerRuntime["createGithubReader"]>((access) => {
    githubTokens.set(githubTokens.size, access.token);
    return githubReader;
  });
  const createRelay = vi.fn<RelayServerRuntime["createRelay"]>((dependencies) => {
    relayDependencies.set(relayDependencies.size, dependencies);
    return {
      server: {
        listen:
          options.listen ??
          ((port, onListening) => {
            listenedPorts.set(listenedPorts.size, port);
            onListening();
          }),
        once: (_event, listener) => {
          serverErrorListeners.add(listener);
        },
        off: (_event, listener) => {
          serverErrorListeners.delete(listener);
        },
      },
      shutdown,
    };
  });
  const createLogFileSink =
    options.createLogFileSink ??
    vi.fn<RelayServerRuntime["createLogFileSink"]>(() => ({ append: () => undefined }));
  const runtime: RelayServerRuntime = {
    environment: {
      ...requiredEnvironment,
      GH_TOKEN: "primary-token",
      ...options.environment,
    },
    currentDirectory: () => "/repository",
    nowIso: () => "2026-08-13T00:00:00.000Z",
    fetchImpl: fetch,
    signalTarget: signals.target,
    stdout: stdout.stream,
    stderr: stderr.stream,
    exit,
    createGithubReader,
    createLogFileSink,
    createRelay,
  };
  return {
    runtime,
    stdout,
    stderr,
    signals,
    githubTokens,
    relayDependencies,
    listenedPorts,
    shutdown,
    exit,
    exited: exited.promise,
    failServer: (failure: Error) => {
      for (const listener of serverErrorListeners) {
        serverErrorListeners.delete(listener);
        listener(failure);
      }
    },
    serverErrorListenerCount: () => serverErrorListeners.size,
    createGithubReader,
    createRelay,
  };
};

const start = (runtime: RelayServerRuntime): RunningRelayServer => {
  const running = runRelayServerModule(true, runtime);
  if (running === null) throw new Error("the relay server module did not start");
  onTestFinished(() => {
    running.shutdownRegistration.release();
  });
  return running;
};

const shutdownReport = async (signal: ShutdownSignal) => {
  const setup = runtimeFixture();
  start(setup.runtime);

  setup.signals.fire(signal);
  const exitCode = await setup.exited;
  return {
    exitCode,
    shutdownCalls: setup.shutdown.mock.calls,
    exitCalls: setup.exit.mock.calls,
    loggedSignal: setup.stdout.text().includes(`"signal":"${signal}"`),
    loggedShutdown: setup.stdout.text().includes("shutting down relay server"),
  };
};

describe("relay server entrypoint", () => {
  test("GH_TOKEN を GITHUB_TOKEN より優先して listen callback を公開する", async () => {
    const setup = runtimeFixture({ environment: { GITHUB_TOKEN: "fallback-token" } });
    start(setup.runtime);

    expect(setup.githubTokens.get(0)).toBe("primary-token");
    expect(setup.listenedPorts.get(0)).toBe(43_123);
    expect(setup.stdout.text()).toContain('"port":43123');
    expect(setup.stdout.text()).toContain("relay server listening");
    const dependencies = setup.relayDependencies.get(0);
    if (dependencies === undefined) throw new Error("relay dependencies were not captured");
    await expect(
      dependencies.verifyIdToken({ idToken: "id-token", audience: "https://relay.example" }),
    ).rejects.toThrow(IdTokenRejectionError);
  });

  test("GH_TOKEN が無ければ GITHUB_TOKEN を使う", () => {
    const setup = runtimeFixture({
      environment: { GH_TOKEN: undefined, GITHUB_TOKEN: "fallback-token" },
    });
    start(setup.runtime);

    expect(setup.githubTokens.get(0)).toBe("fallback-token");
  });

  test("GitHub token がどちらも無ければ listen 前に拒否する", () => {
    const setup = runtimeFixture({
      environment: { GH_TOKEN: undefined, GITHUB_TOKEN: undefined },
    });

    expect(() => runRelayServerModule(true, setup.runtime)).toThrow(
      "GH_TOKEN or GITHUB_TOKEN must be set for GitHub API access",
    );
    expect(setup.createGithubReader).not.toHaveBeenCalled();
    expect(setup.createRelay).not.toHaveBeenCalled();
  });

  test("main でない import はサーバーを起動しない", () => {
    const setup = runtimeFixture();

    expect(runRelayServerModule(false, setup.runtime)).toBeNull();
    expect(setup.createRelay).not.toHaveBeenCalled();
  });

  test("SIGINT は relay を停止して 0 で終了する", async () => {
    expect(await shutdownReport("SIGINT")).toStrictEqual({
      exitCode: 0,
      shutdownCalls: [[]],
      exitCalls: [[0]],
      loggedSignal: true,
      loggedShutdown: true,
    });
  });

  test("SIGTERM は relay を停止して 0 で終了する", async () => {
    expect(await shutdownReport("SIGTERM")).toStrictEqual({
      exitCode: 0,
      shutdownCalls: [[]],
      exitCalls: [[0]],
      loggedSignal: true,
      loggedShutdown: true,
    });
  });

  test("停止中の追加 signal は同じ shutdown Promise に合流する", async () => {
    const deferredShutdown = Promise.withResolvers<undefined>();
    const setup = runtimeFixture({ shutdown: () => deferredShutdown.promise });
    start(setup.runtime);

    setup.signals.fire("SIGINT");
    setup.signals.fire("SIGTERM");

    expect(setup.shutdown.mock.calls).toStrictEqual([[]]);
    expect(setup.signals.listenerCount()).toBe(0);
    expect(setup.serverErrorListenerCount()).toBe(0);
    deferredShutdown.resolve(undefined);
    await expect(setup.exited).resolves.toBe(0);
    expect(setup.exit.mock.calls).toStrictEqual([[0]]);
  });

  test("shutdown 失敗は診断して 1 で終了する", async () => {
    const setup = runtimeFixture({
      shutdown: () => Promise.reject(new Error("close failed")),
    });
    start(setup.runtime);

    setup.signals.fire("SIGTERM");

    await expect(setup.exited).resolves.toBe(1);
    expect(setup.exit.mock.calls).toStrictEqual([[1]]);
    expect(setup.stdout.text()).toContain("relay server shutdown failed");
    expect(setup.stdout.text()).toContain("close failed");
  });

  test("非同期 server error は listener を解除して 1 で終了する", async () => {
    const setup = runtimeFixture();
    start(setup.runtime);

    setup.failServer(new Error("address already in use"));

    await expect(setup.exited).resolves.toBe(1);
    expect(setup.shutdown.mock.calls).toStrictEqual([[]]);
    expect(setup.signals.listenerCount()).toBe(0);
    expect(setup.serverErrorListenerCount()).toBe(0);
    expect(setup.stdout.text()).toContain("relay server failed");
    expect(setup.stdout.text()).toContain("address already in use");
  });

  test("同期 listen failure は listener を解除して再送出する", () => {
    const listenFailure = new Error("listen failed");
    const setup = runtimeFixture({
      listen: () => {
        throw listenFailure;
      },
    });

    expect(() => runRelayServerModule(true, setup.runtime)).toThrow(listenFailure);
    expect(setup.signals.listenerCount()).toBe(0);
    expect(setup.serverErrorListenerCount()).toBe(0);
    expect(setup.stdout.text()).toContain("relay server failed to listen");
  });

  test("明示 release は signal と server error listener を両方解除する", () => {
    const setup = runtimeFixture();
    const running = start(setup.runtime);

    expect(setup.signals.listenerCount()).toBe(2);
    expect(setup.serverErrorListenerCount()).toBe(1);
    running.shutdownRegistration.release();
    expect(setup.signals.listenerCount()).toBe(0);
    expect(setup.serverErrorListenerCount()).toBe(0);
  });

  test("ログファイル追記失敗は stderr の診断へ渡す", () => {
    const setup = runtimeFixture({
      createLogFileSink: (sink) => ({
        append: () => {
          sink.onFailure(new Error("disk unavailable"));
        },
      }),
    });
    start(setup.runtime);

    expect(setup.stderr.text()).toContain(
      "could not append to the log file: Error: disk unavailable",
    );
  });

  test("公開serverは起動せずにimportできる", async () => {
    const serverModule = await import("./server.ts");
    expect(Object.keys(serverModule)).toStrictEqual([]);
  });

  test("公開serverを直接実行すると起動検証が走る", { timeout: 15_000 }, () => {
    const environment = Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] =>
          entry[1] !== undefined && entry[0] !== "GH_TOKEN" && entry[0] !== "GITHUB_TOKEN",
      ),
    );
    const execution = spawnSync(process.execPath, [serverPath], {
      encoding: "utf8",
      env: { ...environment, ...requiredEnvironment },
      killSignal: "SIGKILL",
      timeout: 10_000,
    });

    expect(execution.error).toBeUndefined();
    expect(execution.signal).toBeNull();
    expect(execution.status).not.toBe(0);
    expect(execution.stderr).toContain(
      "GH_TOKEN or GITHUB_TOKEN must be set for GitHub API access",
    );
  });
});
