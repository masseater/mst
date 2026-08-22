import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";

import { standardIoTest as test } from "@mst/dont-review-it/vitest";
import { describe, expect, vi } from "vite-plus/test";

import { runRelayServerModule } from "./relay-server.ts";
import { IdTokenRejectionError } from "./relay/id-token-rejection-error.ts";
import { SOCKET_LIFECYCLE_EVENT } from "./runtime/event-names.ts";

import type { RelayServerRuntime } from "./relay-server-runtime.ts";
import type { GithubReader } from "./relay/github-reader.ts";
import type { RelayDependencies } from "./relay/routes.ts";
import type { SignalTarget } from "./runtime/shutdown.ts";

const REQUIRED_ENVIRONMENT = {
  GITHUB_REPOSITORY: "example/repository",
  GITHUB_WEBHOOK_SECRET: "webhook-secret",
  PORT: "43123",
  AUTO_DEVELOP_LOG_DIR: "/relay-logs",
};

describe("relay server entrypoint", () => {
  const it = test
    .extend("githubReader", {
      resolveTokenLogin: () => Promise.resolve("operator"),
      readRepositoryPrivacy: () => Promise.resolve(false),
      listOpenPullRequests: () => Promise.resolve([]),
      resolvePullAuthor: () => Promise.resolve(null),
      listCheckBuckets: () => Promise.resolve([]),
    } satisfies GithubReader)
    .extend("primaryGithubAccess", async ({ githubReader }, { onCleanup }) => {
      const capturedAccess =
        Promise.withResolvers<Parameters<RelayServerRuntime["createGithubReader"]>[0]>();
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: {
          ...REQUIRED_ENVIRONMENT,
          GH_TOKEN: "primary-token",
          GITHUB_TOKEN: "fallback-token",
        },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: (access) => {
          capturedAccess.resolve(access);
          return githubReader;
        },
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      const running = runRelayServerModule(true, runtime);
      if (running === null) throw new Error("the relay server module did not start");
      onCleanup(running.shutdownRegistration.release);
      return Promise.resolve(capturedAccess.promise);
    })
    .extend("fallbackGithubAccess", async ({ githubReader }, { onCleanup }) => {
      const capturedAccess =
        Promise.withResolvers<Parameters<RelayServerRuntime["createGithubReader"]>[0]>();
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: {
          ...REQUIRED_ENVIRONMENT,
          GH_TOKEN: undefined,
          GITHUB_TOKEN: "fallback-token",
        },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: (access) => {
          capturedAccess.resolve(access);
          return githubReader;
        },
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      const running = runRelayServerModule(true, runtime);
      if (running === null) throw new Error("the relay server module did not start");
      onCleanup(running.shutdownRegistration.release);
      return Promise.resolve(capturedAccess.promise);
    })
    .extend("idTokenRejection", async ({ githubReader }, { onCleanup }) => {
      const capturedDependencies = Promise.withResolvers<RelayDependencies>();
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: (dependencies) => {
          capturedDependencies.resolve(dependencies);
          return {
            server: {
              listen: (_port, onListening) => {
                onListening();
              },
              once: serverEvents.once.bind(serverEvents),
              off: serverEvents.off.bind(serverEvents),
            },
            shutdown: () => Promise.resolve(),
          };
        },
      };
      const running = runRelayServerModule(true, runtime);
      if (running === null) throw new Error("the relay server module did not start");
      onCleanup(running.shutdownRegistration.release);
      const dependencies = await capturedDependencies.promise;
      try {
        await dependencies.verifyIdToken({
          idToken: "id-token",
          audience: "https://relay.example",
        });
      } catch (verificationFailure) {
        return verificationFailure;
      }
      throw new Error("the injected id token verifier accepted a token");
    })
    .extend("missingTokenRejection", ({ githubReader }) => {
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: {
          ...REQUIRED_ENVIRONMENT,
          GH_TOKEN: undefined,
          GITHUB_TOKEN: undefined,
        },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      try {
        runRelayServerModule(true, runtime);
      } catch (missingTokenFailure) {
        return missingTokenFailure;
      }
      throw new Error("a missing GitHub token was accepted");
    })
    .extend("inactiveRelay", ({ githubReader }) => {
      const runtime: RelayServerRuntime = {
        environment: {},
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: new EventEmitter() as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => {
          throw new Error("a non-main import tried to create the relay");
        },
      };
      return runRelayServerModule(false, runtime);
    })
    .extend("signalExit", async ({ githubReader }) => {
      const exited = Promise.withResolvers<number>();
      const exit = vi.fn<(code: number) => void>((code) => {
        exited.resolve(code);
      });
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      runRelayServerModule(true, runtime);
      signalEvents.emit("SIGINT");
      await exited.promise;
      return exit;
    })
    .extend("terminationExit", async ({ githubReader }) => {
      const exited = Promise.withResolvers<number>();
      const exit = vi.fn<(code: number) => void>((code) => {
        exited.resolve(code);
      });
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      runRelayServerModule(true, runtime);
      signalEvents.emit("SIGTERM");
      await exited.promise;
      return exit;
    })
    .extend("joinedSignalsExit", async ({ githubReader }) => {
      const exited = Promise.withResolvers<number>();
      const exit = vi.fn<(code: number) => void>((code) => {
        exited.resolve(code);
      });
      const shutdownEntered = Promise.withResolvers<undefined>();
      const shutdownFinished = Promise.withResolvers<undefined>();
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => {
            shutdownEntered.resolve(undefined);
            return shutdownFinished.promise;
          },
        }),
      };
      runRelayServerModule(true, runtime);
      signalEvents.emit("SIGINT");
      await shutdownEntered.promise;
      signalEvents.emit("SIGTERM");
      shutdownFinished.resolve(undefined);
      await exited.promise;
      return exit;
    })
    .extend("failedShutdownExit", async ({ githubReader }) => {
      const exited = Promise.withResolvers<number>();
      const exit = vi.fn<(code: number) => void>((code) => {
        exited.resolve(code);
      });
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.reject(new Error("close failed")),
        }),
      };
      runRelayServerModule(true, runtime);
      signalEvents.emit("SIGTERM");
      await exited.promise;
      return exit;
    })
    .extend("serverFailureExit", async ({ githubReader }) => {
      const exited = Promise.withResolvers<number>();
      const exit = vi.fn<(code: number) => void>((code) => {
        exited.resolve(code);
      });
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      runRelayServerModule(true, runtime);
      serverEvents.emit(SOCKET_LIFECYCLE_EVENT.failure, new Error("address already in use"));
      await exited.promise;
      return exit;
    })
    .extend("listenRejection", ({ githubReader }) => {
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const listenFailure = new Error("listen failed");
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: () => {
              throw listenFailure;
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      try {
        runRelayServerModule(true, runtime);
      } catch (listenRejection) {
        return listenRejection;
      }
      throw new Error("a synchronous listen failure was swallowed");
    })
    .extend("serverFailureListenersAfterRelease", ({ githubReader }) => {
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: () => githubReader,
        createLogFileSink: () => ({ append: () => undefined }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      const running = runRelayServerModule(true, runtime);
      if (running === null) throw new Error("the relay server module did not start");
      running.shutdownRegistration.release();
      return serverEvents.listenerCount(SOCKET_LIFECYCLE_EVENT.failure);
    })
    .extend("logSinkFailureDiagnostic", ({ githubReader, stderr }, { onCleanup }) => {
      const signalEvents = new EventEmitter();
      const serverEvents = new EventEmitter();
      const runtime: RelayServerRuntime = {
        environment: { ...REQUIRED_ENVIRONMENT, GH_TOKEN: "primary-token" },
        currentDirectory: () => "/repository",
        nowIso: () => "2026-08-13T00:00:00.000Z",
        fetchImpl: fetch,
        signalTarget: signalEvents as SignalTarget,
        stdout: process.stdout,
        stderr: process.stderr,
        exit: () => undefined,
        createGithubReader: () => githubReader,
        createLogFileSink: (sink) => ({
          append: () => {
            sink.onFailure(new Error("disk unavailable"));
          },
        }),
        createRelay: () => ({
          server: {
            listen: (_port, onListening) => {
              onListening();
            },
            once: serverEvents.once.bind(serverEvents),
            off: serverEvents.off.bind(serverEvents),
          },
          shutdown: () => Promise.resolve(),
        }),
      };
      const running = runRelayServerModule(true, runtime);
      if (running === null) throw new Error("the relay server module did not start");
      onCleanup(running.shutdownRegistration.release);
      return stderr.text();
    })
    .extend("directEntryExitStatus", () => {
      const directRun = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./server.ts", import.meta.url))],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            GH_TOKEN: undefined,
            GITHUB_TOKEN: undefined,
            ...REQUIRED_ENVIRONMENT,
          },
          killSignal: "SIGKILL",
          timeout: 10_000,
        },
      );
      return Math.trunc(directRun.status ?? -1);
    })
    .extend("directEntrySignal", () => {
      const directRun = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./server.ts", import.meta.url))],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            GH_TOKEN: undefined,
            GITHUB_TOKEN: undefined,
            ...REQUIRED_ENVIRONMENT,
          },
          killSignal: "SIGKILL",
          timeout: 10_000,
        },
      );
      return String(directRun.signal);
    })
    .extend("directEntryStarted", () => {
      const directRun = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./server.ts", import.meta.url))],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            GH_TOKEN: undefined,
            GITHUB_TOKEN: undefined,
            ...REQUIRED_ENVIRONMENT,
          },
          killSignal: "SIGKILL",
          timeout: 10_000,
        },
      );
      return Object.is(directRun.error, undefined);
    })
    .extend("directEntryDiagnostic", () => {
      const directRun = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("./server.ts", import.meta.url))],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            GH_TOKEN: undefined,
            GITHUB_TOKEN: undefined,
            ...REQUIRED_ENVIRONMENT,
          },
          killSignal: "SIGKILL",
          timeout: 10_000,
        },
      );
      return directRun.stderr.includes(
        "GH_TOKEN or GITHUB_TOKEN must be set for GitHub API access",
      );
    })
    .extend("serverModuleKeys", async () => Object.keys(await import("./server.ts")));

  it("GH_TOKEN を GITHUB_TOKEN より優先する", ({ primaryGithubAccess }) => {
    expect(primaryGithubAccess).toMatchInlineSnapshot(`
      {
        "accessFor": [Function],
        "repository": "example/repository",
        "token": "primary-token",
      }
    `);
  });

  it("GH_TOKEN が無ければ GITHUB_TOKEN を使う", ({ fallbackGithubAccess }) => {
    expect(fallbackGithubAccess).toMatchInlineSnapshot(`
      {
        "accessFor": [Function],
        "repository": "example/repository",
        "token": "fallback-token",
      }
    `);
  });

  it("注入する ID token verifier は未配線として拒否する", ({ idTokenRejection }) => {
    expect(idTokenRejection).toStrictEqual(
      new IdTokenRejectionError("no id token verifier is wired into this build"),
    );
  });

  it("GitHub token がどちらも無ければ listen 前に拒否する", ({ missingTokenRejection }) => {
    expect(missingTokenRejection).toStrictEqual(
      new Error("GH_TOKEN or GITHUB_TOKEN must be set for GitHub API access"),
    );
  });

  it("main でない import はサーバーを起動しない", ({ inactiveRelay }) => {
    expect(inactiveRelay).toBe(null);
  });

  it("SIGINT は relay を停止して 0 で終了する", ({ signalExit }) => {
    expect(signalExit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("SIGTERM は relay を停止して 0 で終了する", ({ terminationExit }) => {
    expect(terminationExit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("停止中の追加 signal は同じ shutdown Promise に合流する", ({ joinedSignalsExit }) => {
    expect(joinedSignalsExit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("shutdown 失敗は 1 で終了する", ({ failedShutdownExit }) => {
    expect(failedShutdownExit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("非同期 server error は 1 で終了する", ({ serverFailureExit }) => {
    expect(serverFailureExit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("同期 listen failure は再送出する", ({ listenRejection }) => {
    expect(listenRejection).toStrictEqual(new Error("listen failed"));
  });

  it("明示 release は server error listener を解除する", ({
    serverFailureListenersAfterRelease,
  }) => {
    expect(serverFailureListenersAfterRelease).toBe(0);
  });

  it("ログファイル追記失敗は stderr の診断へ渡す", ({ logSinkFailureDiagnostic }) => {
    expect(logSinkFailureDiagnostic).toBe(
      "could not append to the log file: Error: disk unavailable\n",
    );
  });

  it("公開 server は起動せずに import できる", ({ serverModuleKeys }) => {
    expect(serverModuleKeys).toStrictEqual([]);
  });

  it("公開 server の直接実行は 0 以外で終了する", ({ directEntryExitStatus }) => {
    expect(directEntryExitStatus).toBe(1);
  });

  it("公開 server の直接実行は signal で終了しない", ({ directEntrySignal }) => {
    expect(directEntrySignal).toBe("null");
  });

  it("公開 server の直接実行は子processを起動できる", ({ directEntryStarted }) => {
    expect(directEntryStarted).toBe(true);
  });

  it("公開 server の直接実行は起動検証の診断を返す", ({ directEntryDiagnostic }) => {
    expect(directEntryDiagnostic).toBe(true);
  });

  it("シナリオを起動しないテストの stdout は空のままになる", ({ stdout }) => {
    expect(stdout).toMatchInlineSnapshot(`
      {
        "chunks": [],
      }
    `);
  });

  it("シナリオを起動しないテストの stderr は空のままになる", ({ stderr }) => {
    expect(stderr).toMatchInlineSnapshot(`
      {
        "chunks": [],
      }
    `);
  });
});
