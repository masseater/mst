import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { EngineAuthExpiredError } from "./auth-expiry.ts";
import { createEngine, type EngineConfig } from "./engine.ts";
import { ProcessFailedError } from "./process-failed-error.ts";

import type { TmuxRunRequest } from "./tmux-runner.ts";

type EngineRunner = EngineConfig["runner"];

const collect = async (stream: AsyncGenerator<string, void, undefined>): Promise<string> => {
  const chunks = new Map<number, string>();
  for await (const chunk of stream) chunks.set(chunks.size, chunk);
  return [...chunks.values()].join("");
};

const emittingRunner = (
  chunks: readonly string[],
): { readonly runner: EngineRunner; readonly requests: () => readonly TmuxRunRequest[] } => {
  const seen = new Map<number, TmuxRunRequest>();
  const runner: EngineRunner = async function* run(request) {
    seen.set(seen.size, request);
    for (const chunk of chunks) yield chunk;
  };
  return { runner, requests: () => [...seen.values()] };
};

const failingRunner = (failure: Error): EngineRunner => {
  const runner: EngineRunner = async function* run() {
    await Promise.resolve();
    yield "";
    throw failure;
  };
  return runner;
};

const rejectionOf = async (stream: AsyncGenerator<string, void, undefined>): Promise<unknown> => {
  try {
    await collect(stream);
    return undefined;
  } catch (streamFailure) {
    return streamFailure;
  }
};

const configWith = (overrides: Partial<EngineConfig>): EngineConfig => ({
  kind: "claude",
  resolveGitPaths: () => Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
  timeoutMs: 3 * 24 * 60 * 60 * 1000,
  bypassPermissions: false,
  runner: emittingRunner([]).runner,
  killSession: () => Promise.resolve(),
  log: silentLogger,
  ...overrides,
});

const claudeRunWithBypass = async (): Promise<TmuxRunRequest | undefined> => {
  const { runner, requests } = emittingRunner([]);
  const engine = createEngine(configWith({ runner, bypassPermissions: true }));
  await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
  return requests()[0];
};

const codexRun = async (): Promise<{
  readonly gitPathCalls: readonly (readonly [string])[];
  readonly request: TmuxRunRequest | undefined;
}> => {
  const { runner, requests } = emittingRunner([]);
  const resolveGitPaths = vi.fn<EngineConfig["resolveGitPaths"]>(() =>
    Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
  );
  const engine = createEngine(configWith({ kind: "codex", runner, resolveGitPaths }));
  await collect(engine.execute({ prompt: "fix", cwd: "/work/pr-1", prNumber: 7 }));
  return { gitPathCalls: resolveGitPaths.mock.calls, request: requests()[0] };
};

const overriddenRun = async (): Promise<TmuxRunRequest | undefined> => {
  const { runner, requests } = emittingRunner([]);
  const engine = createEngine(configWith({ runner, launchOverride: "wrapper sub" }));
  await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
  return requests()[0];
};

const expiredAuthFailure = new ProcessFailedError({
  command: "codex",
  exitCode: 1,
  output: "refresh_token_invalidated",
});

const abortedRun = async (): Promise<{
  readonly forwardedSignal: AbortSignal | undefined;
  readonly passedSignal: AbortSignal;
}> => {
  const { runner, requests } = emittingRunner([]);
  const engine = createEngine(configWith({ runner }));
  const abort = new AbortController();
  await collect(
    engine.execute({ prompt: "review", cwd: "/work", prNumber: 7, signal: abort.signal }),
  );
  return { forwardedSignal: requests()[0]?.signal, passedSignal: abort.signal };
};

const warningsForTwoBypassedRuns = async (): Promise<number> => {
  const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
  const engine = createEngine(
    configWith({ bypassPermissions: true, log: { ...silentLogger, warn } }),
  );
  await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
  await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 8 }));
  return warn.mock.calls.length;
};

const killedSessions = async (): Promise<readonly (readonly [string])[]> => {
  const killSession = vi.fn<(sessionName: string) => Promise<void>>(() => Promise.resolve());
  const engine = createEngine(configWith({ killSession }));
  await engine.kill(7);
  return killSession.mock.calls;
};

const warningsForFailingKill = async (): Promise<number> => {
  const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
  const engine = createEngine(
    configWith({
      killSession: () => Promise.reject(new Error("no session")),
      log: { ...silentLogger, warn },
    }),
  );
  await engine.kill(7);
  return warn.mock.calls.length;
};

const it = test
  .extend("forwardedOutput", () => {
    const { runner } = emittingRunner(["hello ", "world"]);
    const engine = createEngine(configWith({ runner }));
    return collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
  })
  .extend("claudeRequest", () => claudeRunWithBypass())
  .extend("codexExecution", () => codexRun())
  .extend("overriddenRequest", () => overriddenRun())
  .extend("expiredAuthRejection", () => {
    const engine = createEngine(
      configWith({ kind: "codex", runner: failingRunner(expiredAuthFailure) }),
    );
    return rejectionOf(engine.execute({ prompt: "fix", cwd: "/work", prNumber: 7 }));
  })
  .extend("signalForwarding", () => abortedRun())
  .extend("bypassWarningCount", () => warningsForTwoBypassedRuns())
  .extend("killSessionCalls", () => killedSessions())
  .extend("failingKillWarningCount", () => warningsForFailingKill());

describe("createEngine execute", () => {
  it("runner の出力断片を無加工で転送する", ({ forwardedOutput }) => {
    expect(forwardedOutput).toStrictEqual("hello world");
  });

  it("claude はセッション名を runner へ渡す", ({ claudeRequest }) => {
    expect(claudeRequest?.sessionName).toStrictEqual("auto-develop-pr-7");
  });

  it("claude はバイナリ名を runner へ渡す", ({ claudeRequest }) => {
    expect(claudeRequest?.binary).toStrictEqual("claude");
  });

  it("claude は引数を runner へ渡す", ({ claudeRequest }) => {
    expect(claudeRequest?.args).toStrictEqual([
      "-p",
      "--dangerously-skip-permissions",
      "--name",
      "auto-develop-pr-7",
      "review",
    ]);
  });

  it("claude は無反応タイムアウトを runner へ渡す", ({ claudeRequest }) => {
    expect(claudeRequest?.idleTimeoutMs).toStrictEqual(1_800_000);
  });

  it("codex は git パス解決を作業ディレクトリで呼ぶ", ({ codexExecution }) => {
    expect(codexExecution.gitPathCalls).toStrictEqual([["/work/pr-1"]]);
  });

  it("codex は解決したパスを引数へ組み込む", ({ codexExecution }) => {
    expect(codexExecution.request?.args).toContain("--add-dir");
  });

  it("上書きはバイナリを差し替える", ({ overriddenRequest }) => {
    expect(overriddenRequest?.binary).toStrictEqual("wrapper");
  });

  it("上書きは接頭引数を前置する", ({ overriddenRequest }) => {
    expect(overriddenRequest?.args[0]).toStrictEqual("sub");
  });

  it("上書きの接頭引数の後に本来の引数が続く", ({ overriddenRequest }) => {
    expect(overriddenRequest?.args[1]).toStrictEqual("-p");
  });

  it("認証失効パターンに一致する失敗は型付きエラーへ昇格する", ({ expiredAuthRejection }) => {
    expect(expiredAuthRejection).toBeInstanceOf(EngineAuthExpiredError);
  });

  it("昇格したエラーは元のプロセス失敗を cause に持つ", ({ expiredAuthRejection }) => {
    expect((expiredAuthRejection as EngineAuthExpiredError).cause).toStrictEqual(
      expiredAuthFailure,
    );
  });

  it("認証失効パターンに一致しない失敗は元の例外のまま再送出する", async () => {
    const processFailure = new ProcessFailedError({
      command: "claude",
      exitCode: 1,
      output: "quality check failed",
    });
    const engine = createEngine(configWith({ runner: failingRunner(processFailure) }));
    const streaming = collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
    await expect(streaming).rejects.toThrow(processFailure);
  });

  it("プロセス失敗でない例外はそのまま再送出する", async () => {
    const timeoutFailure = new Error("engine run exceeded the 1000ms timeout");
    const engine = createEngine(configWith({ runner: failingRunner(timeoutFailure) }));
    const streaming = collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
    await expect(streaming).rejects.toThrow(timeoutFailure);
  });

  it("中断シグナルは runner へ転送される", ({ signalForwarding }) => {
    expect(signalForwarding.forwardedSignal).toStrictEqual(signalForwarding.passedSignal);
  });

  it("バイパス有効時の警告はエンジン生成時に 1 回だけ出る", ({ bypassWarningCount }) => {
    expect(bypassWarningCount).toStrictEqual(1);
  });
});

describe("createEngine kill", () => {
  it("PR 番号のセッションを 1 回強制終了する", ({ killSessionCalls }) => {
    expect(killSessionCalls).toStrictEqual([["auto-develop-pr-7"]]);
  });

  it("kill の失敗は例外にせず警告のみ", ({ failingKillWarningCount }) => {
    expect(failingKillWarningCount).toStrictEqual(1);
  });
});
