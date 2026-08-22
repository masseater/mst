import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger, type Logger } from "../logging/logger.ts";
import { EngineAuthExpiredError } from "./auth-expiry.ts";
import { createEngine, type EngineConfig } from "./engine.ts";
import { ProcessFailedError } from "./process-failed-error.ts";

const EXPIRED_CODEX_AUTH_FAILURE = new ProcessFailedError({
  command: "codex",
  exitCode: 1,
  output: "refresh_token_invalidated",
});

const QUALITY_CHECK_FAILURE = new ProcessFailedError({
  command: "claude",
  exitCode: 1,
  output: "quality check failed",
});

const UNRESPONSIVE_RUN_FAILURE = new Error("engine run exceeded the 1000ms timeout");

const MISSING_SESSION_FAILURE = new Error("no session");

const FORWARDED_ABORT_SIGNAL = new AbortController().signal;

describe("createEngine execute", () => {
  describe("a run whose runner writes two chunks", () => {
    const it = test.extend("theChunksForwardedFromTheRunner", () => {
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner: async function* run(): AsyncGenerator<string, void, undefined> {
          yield await Promise.resolve("hello ");
          yield "world";
        },
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      return Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
    });

    it("hands every chunk on unaltered", ({ theChunksForwardedFromTheRunner }) => {
      expect(theChunksForwardedFromTheRunner).toStrictEqual(["hello ", "world"]);
    });
  });

  describe("a claude run that bypasses the permission prompt", () => {
    const it = test.extend("theRunRequestOfABypassingClaudeRun", async () => {
      const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
        string,
        void,
        undefined
      > {
        yield* await Promise.resolve([]);
      });
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: true,
        runner,
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      await Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
      return runner;
    });

    it("asks the runner for a session named after the pull request", ({
      theRunRequestOfABypassingClaudeRun,
    }) => {
      expect(theRunRequestOfABypassingClaudeRun).toHaveBeenCalledWith({
        binary: "claude",
        args: ["-p", "--dangerously-skip-permissions", "--name", "auto-develop-pr-7", "review"],
        cwd: "/work",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
      });
    });
  });

  describe("a claude run that keeps the permission prompt", () => {
    const it = test.extend("theRunRequestOfAPermissionKeepingClaudeRun", async () => {
      const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
        string,
        void,
        undefined
      > {
        yield* await Promise.resolve([]);
      });
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner,
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      await Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
      return runner;
    });

    it("asks the runner to run claude under the automatic permission mode", ({
      theRunRequestOfAPermissionKeepingClaudeRun,
    }) => {
      expect(theRunRequestOfAPermissionKeepingClaudeRun).toHaveBeenCalledWith({
        binary: "claude",
        args: ["-p", "--permission-mode", "auto", "--name", "auto-develop-pr-7", "review"],
        cwd: "/work",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
      });
    });
  });

  describe("a codex run inside a worktree of a shared repository", () => {
    const it = test
      .extend("theGitPathLookupOfACodexRun", async () => {
        const resolveGitPaths = vi.fn<EngineConfig["resolveGitPaths"]>(() =>
          Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        );
        const engine = createEngine({
          kind: "codex",
          resolveGitPaths,
          timeoutMs: 259_200_000,
          bypassPermissions: false,
          runner: async function* run(): AsyncGenerator<string, void, undefined> {
            yield* await Promise.resolve([]);
          },
          killSession: () => Promise.resolve(),
          log: silentLogger,
        });
        await Array.fromAsync(engine.execute({ prompt: "fix", cwd: "/work/pr-1", prNumber: 7 }));
        return resolveGitPaths;
      })
      .extend("theRunRequestOfACodexRun", async () => {
        const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
          string,
          void,
          undefined
        > {
          yield* await Promise.resolve([]);
        });
        const engine = createEngine({
          kind: "codex",
          resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
          timeoutMs: 259_200_000,
          bypassPermissions: false,
          runner,
          killSession: () => Promise.resolve(),
          log: silentLogger,
        });
        await Array.fromAsync(engine.execute({ prompt: "fix", cwd: "/work/pr-1", prNumber: 7 }));
        return runner;
      })
      .extend("theRunRequestOfABypassingCodexRun", async () => {
        const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
          string,
          void,
          undefined
        > {
          yield* await Promise.resolve([]);
        });
        const engine = createEngine({
          kind: "codex",
          resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
          timeoutMs: 259_200_000,
          bypassPermissions: true,
          runner,
          killSession: () => Promise.resolve(),
          log: silentLogger,
        });
        await Array.fromAsync(engine.execute({ prompt: "fix", cwd: "/work/pr-1", prNumber: 7 }));
        return runner;
      });

    it("looks the git paths up from the working directory of the run", ({
      theGitPathLookupOfACodexRun,
    }) => {
      expect(theGitPathLookupOfACodexRun).toHaveBeenCalledWith("/work/pr-1");
    });

    it("asks the runner to reach the repository root and the shared git directory", ({
      theRunRequestOfACodexRun,
    }) => {
      expect(theRunRequestOfACodexRun).toHaveBeenCalledWith({
        binary: "codex",
        args: [
          "-a",
          "on-request",
          "-c",
          'approvals_reviewer="auto_review"',
          "exec",
          "-C",
          "/work/pr-1",
          "--add-dir",
          "/repo",
          "--add-dir",
          "/repo/.git",
          "fix",
        ],
        cwd: "/work/pr-1",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
      });
    });

    it("asks the runner to skip the approval prompt when the bypass is on", ({
      theRunRequestOfABypassingCodexRun,
    }) => {
      expect(theRunRequestOfABypassingCodexRun).toHaveBeenCalledWith({
        binary: "codex",
        args: [
          "-a",
          "never",
          "exec",
          "--dangerously-bypass-approvals-and-sandbox",
          "-C",
          "/work/pr-1",
          "--add-dir",
          "/repo",
          "--add-dir",
          "/repo/.git",
          "fix",
        ],
        cwd: "/work/pr-1",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
      });
    });
  });

  describe("a codex run whose working directory sits outside a git repository", () => {
    const it = test.extend("theRunRequestOfACodexRunWithoutGitPaths", async () => {
      const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
        string,
        void,
        undefined
      > {
        yield* await Promise.resolve([]);
      });
      const engine = createEngine({
        kind: "codex",
        resolveGitPaths: () => Promise.resolve({ repoRoot: null, sharedGitDir: null }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner,
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      await Array.fromAsync(engine.execute({ prompt: "fix", cwd: "/work", prNumber: 7 }));
      return runner;
    });

    it("asks the runner for no reachable directory beyond the working directory", ({
      theRunRequestOfACodexRunWithoutGitPaths,
    }) => {
      expect(theRunRequestOfACodexRunWithoutGitPaths).toHaveBeenCalledWith({
        binary: "codex",
        args: [
          "-a",
          "on-request",
          "-c",
          'approvals_reviewer="auto_review"',
          "exec",
          "-C",
          "/work",
          "fix",
        ],
        cwd: "/work",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
      });
    });
  });

  describe("a run whose launch is overridden by a wrapper and a subcommand", () => {
    const it = test.extend("theRunRequestOfAWrappedRun", async () => {
      const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
        string,
        void,
        undefined
      > {
        yield* await Promise.resolve([]);
      });
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        launchOverride: "wrapper sub",
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner,
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      await Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
      return runner;
    });

    it("asks the runner for the wrapper with the subcommand ahead of the engine arguments", ({
      theRunRequestOfAWrappedRun,
    }) => {
      expect(theRunRequestOfAWrappedRun).toHaveBeenCalledWith({
        binary: "wrapper",
        args: ["sub", "-p", "--permission-mode", "auto", "--name", "auto-develop-pr-7", "review"],
        cwd: "/work",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
      });
    });
  });

  describe("a run whose launch is overridden by a binary alone", () => {
    const it = test.extend("theRunRequestOfARenamedBinaryRun", async () => {
      const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
        string,
        void,
        undefined
      > {
        yield* await Promise.resolve([]);
      });
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        launchOverride: "wrapper",
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner,
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      await Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
      return runner;
    });

    it("asks the runner for the wrapper with the engine arguments untouched", ({
      theRunRequestOfARenamedBinaryRun,
    }) => {
      expect(theRunRequestOfARenamedBinaryRun).toHaveBeenCalledWith({
        binary: "wrapper",
        args: ["-p", "--permission-mode", "auto", "--name", "auto-develop-pr-7", "review"],
        cwd: "/work",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
      });
    });
  });

  describe("a run carrying an abort signal", () => {
    const it = test.extend("theRunRequestOfAnAbortableRun", async () => {
      const runner = vi.fn<EngineConfig["runner"]>(async function* run(): AsyncGenerator<
        string,
        void,
        undefined
      > {
        yield* await Promise.resolve([]);
      });
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner,
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      await Array.fromAsync(
        engine.execute({
          prompt: "review",
          cwd: "/work",
          prNumber: 7,
          signal: FORWARDED_ABORT_SIGNAL,
        }),
      );
      return runner;
    });

    it("hands the signal on to the runner", ({ theRunRequestOfAnAbortableRun }) => {
      expect(theRunRequestOfAnAbortableRun).toHaveBeenCalledWith({
        binary: "claude",
        args: ["-p", "--permission-mode", "auto", "--name", "auto-develop-pr-7", "review"],
        cwd: "/work",
        sessionName: "auto-develop-pr-7",
        timeoutMs: 259_200_000,
        idleTimeoutMs: 1_800_000,
        signal: FORWARDED_ABORT_SIGNAL,
      });
    });
  });

  describe("a codex run whose failure names an invalidated refresh token", () => {
    const it = test.extend("theRejectionOfAnExpiredCodexAuthRun", async () => {
      const engine = createEngine({
        kind: "codex",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner: async function* run(): AsyncGenerator<string, void, undefined> {
          yield* await Promise.resolve([]);
          throw EXPIRED_CODEX_AUTH_FAILURE;
        },
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      try {
        return await Array.fromAsync(engine.execute({ prompt: "fix", cwd: "/work", prNumber: 7 }));
      } catch (halted) {
        return halted;
      }
    });

    it("raises the failure to the halting authentication error", ({
      theRejectionOfAnExpiredCodexAuthRun,
    }) => {
      expect(theRejectionOfAnExpiredCodexAuthRun).toStrictEqual(
        new EngineAuthExpiredError({
          engine: "codex",
          matchedPattern: "refresh_token_invalidated",
          cause: EXPIRED_CODEX_AUTH_FAILURE,
        }),
      );
    });
  });

  describe("a claude run whose failure names no authentication pattern", () => {
    const it = test.extend("theRejectionOfAFailedQualityCheck", async () => {
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner: async function* run(): AsyncGenerator<string, void, undefined> {
          yield* await Promise.resolve([]);
          throw QUALITY_CHECK_FAILURE;
        },
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      try {
        return await Array.fromAsync(
          engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }),
        );
      } catch (rethrown) {
        return rethrown;
      }
    });

    it("hands the process failure back untouched", ({ theRejectionOfAFailedQualityCheck }) => {
      expect(theRejectionOfAFailedQualityCheck).toBe(QUALITY_CHECK_FAILURE);
    });
  });

  describe("a run whose failure is not a process failure", () => {
    const it = test.extend("theRejectionOfAnUnresponsiveRun", async () => {
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner: async function* run(): AsyncGenerator<string, void, undefined> {
          yield* await Promise.resolve([]);
          throw UNRESPONSIVE_RUN_FAILURE;
        },
        killSession: () => Promise.resolve(),
        log: silentLogger,
      });
      try {
        return await Array.fromAsync(
          engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }),
        );
      } catch (rethrown) {
        return rethrown;
      }
    });

    it("hands the original exception back untouched", ({ theRejectionOfAnUnresponsiveRun }) => {
      expect(theRejectionOfAnUnresponsiveRun).toBe(UNRESPONSIVE_RUN_FAILURE);
    });
  });

  describe("two runs from one engine whose permission bypass is enabled", () => {
    const it = test.extend("theBypassWarningOfTwoRuns", async () => {
      const warn = vi.fn<Logger["warn"]>();
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: true,
        runner: async function* run(): AsyncGenerator<string, void, undefined> {
          yield* await Promise.resolve([]);
        },
        killSession: () => Promise.resolve(),
        log: { ...silentLogger, warn },
      });
      await Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
      await Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 8 }));
      return warn;
    });

    it("warns once, when the engine is built rather than when it runs", ({
      theBypassWarningOfTwoRuns,
    }) => {
      expect(theBypassWarningOfTwoRuns).toHaveBeenCalledExactlyOnceWith(
        { engine: "claude" },
        "engine permission bypass is enabled",
      );
    });
  });

  describe("a run that reaches its end", () => {
    const it = test.extend("theInfoLogOfACompletedRun", async () => {
      const infoLogger = vi.fn<Logger["info"]>();
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner: async function* run(): AsyncGenerator<string, void, undefined> {
          yield* await Promise.resolve([]);
        },
        killSession: () => Promise.resolve(),
        log: { ...silentLogger, info: infoLogger },
      });
      await Array.fromAsync(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
      return infoLogger;
    });

    it("records the completion beside the start", ({ theInfoLogOfACompletedRun }) => {
      expect(theInfoLogOfACompletedRun).toHaveBeenCalledTimes(2);
    });
  });
});

describe("createEngine kill", () => {
  describe("a kill aimed at a pull request number", () => {
    const it = test.extend("theSessionKillOfAPullRequestNumber", async () => {
      const killSession = vi.fn<EngineConfig["killSession"]>(() => Promise.resolve());
      const engine = createEngine({
        kind: "claude",
        resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
        timeoutMs: 259_200_000,
        bypassPermissions: false,
        runner: async function* run(): AsyncGenerator<string, void, undefined> {
          yield* await Promise.resolve([]);
        },
        killSession,
        log: silentLogger,
      });
      await engine.kill(7);
      return killSession;
    });

    it("ends the one session named after that pull request", ({
      theSessionKillOfAPullRequestNumber,
    }) => {
      expect(theSessionKillOfAPullRequestNumber).toHaveBeenCalledExactlyOnceWith(
        "auto-develop-pr-7",
      );
    });
  });

  describe("a kill whose session is already gone", () => {
    const it = test
      .extend("theWarningOfAKillWithNoSession", async () => {
        const warn = vi.fn<Logger["warn"]>();
        const engine = createEngine({
          kind: "claude",
          resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
          timeoutMs: 259_200_000,
          bypassPermissions: false,
          runner: async function* run(): AsyncGenerator<string, void, undefined> {
            yield* await Promise.resolve([]);
          },
          killSession: () => Promise.reject(MISSING_SESSION_FAILURE),
          log: { ...silentLogger, warn },
        });
        await engine.kill(7);
        return warn;
      })
      .extend("theSettlementOfAKillWithNoSession", () => {
        const engine = createEngine({
          kind: "claude",
          resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
          timeoutMs: 259_200_000,
          bypassPermissions: false,
          runner: async function* run(): AsyncGenerator<string, void, undefined> {
            yield* await Promise.resolve([]);
          },
          killSession: () => Promise.reject(MISSING_SESSION_FAILURE),
          log: silentLogger,
        });
        return Promise.allSettled([engine.kill(7)]);
      });

    it("writes the miss down as a warning", ({ theWarningOfAKillWithNoSession }) => {
      expect(theWarningOfAKillWithNoSession).toHaveBeenCalledExactlyOnceWith(
        { prNumber: 7, err: MISSING_SESSION_FAILURE },
        "killing the engine session failed",
      );
    });

    it("settles without an exception", ({ theSettlementOfAKillWithNoSession }) => {
      expect(theSettlementOfAKillWithNoSession).toStrictEqual([
        { status: "fulfilled", value: undefined },
      ]);
    });
  });
});
