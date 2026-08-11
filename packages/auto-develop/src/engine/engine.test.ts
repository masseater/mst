import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { EngineAuthExpiredError } from "./auth-expiry.ts";
import { createEngine, type EngineConfig, type EngineRunner } from "./engine.ts";
import { ProcessFailedError } from "./process-failed-error.ts";

import type { TmuxRunRequest } from "./tmux-runner.ts";

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

describe("createEngine execute", () => {
  test("runner の出力断片を無加工で転送する", async () => {
    const { runner } = emittingRunner(["hello ", "world"]);
    const engine = createEngine(configWith({ runner }));
    const output = await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
    expect(output).toStrictEqual("hello world");
  });

  test("claude はセッション名と引数を runner へ渡す", async () => {
    const { runner, requests } = emittingRunner([]);
    const engine = createEngine(configWith({ runner, bypassPermissions: true }));
    await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
    const [request] = requests();
    expect([
      request?.sessionName,
      request?.binary,
      request?.args,
      request?.idleTimeoutMs,
    ]).toStrictEqual([
      "auto-develop-pr-7",
      "claude",
      ["-p", "--dangerously-skip-permissions", "--name", "auto-develop-pr-7", "review"],
      1_800_000,
    ]);
  });

  test("codex は git パス解決を待ってから引数を組み立てる", async () => {
    const { runner, requests } = emittingRunner([]);
    const resolveGitPaths = vi.fn<EngineConfig["resolveGitPaths"]>(() =>
      Promise.resolve({ repoRoot: "/repo", sharedGitDir: "/repo/.git" }),
    );
    const engine = createEngine(configWith({ kind: "codex", runner, resolveGitPaths }));
    await collect(engine.execute({ prompt: "fix", cwd: "/work/pr-1", prNumber: 7 }));
    expect([resolveGitPaths.mock.calls, requests()[0]?.args.includes("--add-dir")]).toStrictEqual([
      [["/work/pr-1"]],
      true,
    ]);
  });

  test("上書きはバイナリと接頭引数を前置する", async () => {
    const { runner, requests } = emittingRunner([]);
    const engine = createEngine(configWith({ runner, launchOverride: "wrapper sub" }));
    await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
    const [request] = requests();
    expect([request?.binary, request?.args.slice(0, 2)]).toStrictEqual(["wrapper", ["sub", "-p"]]);
  });

  test("認証失効パターンに一致する失敗は型付きエラーへ昇格する", async () => {
    const processFailure = new ProcessFailedError({
      command: "codex",
      exitCode: 1,
      output: "refresh_token_invalidated",
    });
    const engine = createEngine(
      configWith({ kind: "codex", runner: failingRunner(processFailure) }),
    );
    const rejection = await rejectionOf(
      engine.execute({ prompt: "fix", cwd: "/work", prNumber: 7 }),
    );
    expect([
      rejection instanceof EngineAuthExpiredError,
      (rejection as EngineAuthExpiredError).cause,
    ]).toStrictEqual([true, processFailure]);
  });

  test("認証失効パターンに一致しない失敗は元の例外のまま再送出する", async () => {
    const processFailure = new ProcessFailedError({
      command: "claude",
      exitCode: 1,
      output: "quality check failed",
    });
    const engine = createEngine(configWith({ runner: failingRunner(processFailure) }));
    await expect(
      collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 })),
    ).rejects.toThrow(processFailure);
  });

  test("プロセス失敗でない例外はそのまま再送出する", async () => {
    const timeoutFailure = new Error("engine run exceeded the 1000ms timeout");
    const engine = createEngine(configWith({ runner: failingRunner(timeoutFailure) }));
    await expect(
      collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 })),
    ).rejects.toThrow(timeoutFailure);
  });

  test("中断シグナルは runner へ転送される", async () => {
    const { runner, requests } = emittingRunner([]);
    const engine = createEngine(configWith({ runner }));
    const abort = new AbortController();
    await collect(
      engine.execute({ prompt: "review", cwd: "/work", prNumber: 7, signal: abort.signal }),
    );
    expect(requests()[0]?.signal).toStrictEqual(abort.signal);
  });

  test("バイパス有効時の警告はエンジン生成時に 1 回だけ出る", async () => {
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const engine = createEngine(
      configWith({ bypassPermissions: true, log: { ...silentLogger, warn } }),
    );
    await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 7 }));
    await collect(engine.execute({ prompt: "review", cwd: "/work", prNumber: 8 }));
    expect(warn.mock.calls.length).toStrictEqual(1);
  });
});

describe("createEngine kill", () => {
  test("PR 番号のセッションを 1 回強制終了する", async () => {
    const killSession = vi.fn<(sessionName: string) => Promise<void>>(() => Promise.resolve());
    const engine = createEngine(configWith({ killSession }));
    await engine.kill(7);
    expect(killSession.mock.calls).toStrictEqual([["auto-develop-pr-7"]]);
  });

  test("kill の失敗は例外にせず警告のみ", async () => {
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const engine = createEngine(
      configWith({
        killSession: () => Promise.reject(new Error("no session")),
        log: { ...silentLogger, warn },
      }),
    );
    await engine.kill(7);
    expect(warn.mock.calls.length).toStrictEqual(1);
  });
});
