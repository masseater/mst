import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { ProcessFailedError } from "./process-failed-error.ts";
import { runInTmux, type TmuxRunnerDeps, type TmuxRunRequest } from "./tmux-runner.ts";
import { UnresponsiveError } from "./unresponsive-error.ts";

import type { CommandExecutor, TailFs } from "./command-executor.ts";

type SessionScript = {
  readonly aliveForChecks: number;
  readonly outputChunks: readonly string[];
  readonly exitCode: number | null;
};

const scriptedDeps = (
  script: SessionScript,
): {
  readonly deps: TmuxRunnerDeps;
  readonly execArgs: () => readonly string[];
  readonly removed: () => readonly string[];
} => {
  const counters = new Map<string, number>([
    ["aliveChecks", 0],
    ["nowMs", 0],
  ]);
  const execCalls = new Map<number, string>();
  const removedDirs = new Map<number, string>();
  const producedOutput = new Map([["out", ""]]);

  const exec: CommandExecutor = {
    run: (invocation) => {
      execCalls.set(execCalls.size, [invocation.binary, ...invocation.args].join(" "));
      if (invocation.args[0] === "has-session") {
        const checkIndex = counters.get("aliveChecks") as number;
        counters.set("aliveChecks", checkIndex + 1);
        if (checkIndex === 0) return Promise.resolve({ exitCode: 1, stdout: "", stderr: "" });
        const alive = checkIndex <= script.aliveForChecks;
        return Promise.resolve({ exitCode: alive ? 0 : 1, stdout: "", stderr: "" });
      }
      if (invocation.args[0] === "pipe-pane") {
        producedOutput.set("out", script.outputChunks.join(""));
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    },
  };

  const fs: TailFs = {
    makeTempDir: () => "/tmp/auto-develop-tmux-session",
    appendTarget: () => undefined,
    readFrom: ({ offset }) => (producedOutput.get("out") as string).slice(offset),
    readExitCode: () => script.exitCode,
    readAll: () => producedOutput.get("out") as string,
    removeRecursive: (path) => {
      removedDirs.set(removedDirs.size, path);
    },
  };

  return {
    deps: {
      exec,
      fs,
      now: () => counters.get("nowMs") as number,
      sleep: () => {
        counters.set("nowMs", (counters.get("nowMs") as number) + 1);
        return Promise.resolve();
      },
      log: silentLogger,
    },
    execArgs: () => [...execCalls.values()],
    removed: () => [...removedDirs.values()],
  };
};

const baseRequest: TmuxRunRequest = {
  binary: "claude",
  args: ["-p", "hello"],
  cwd: "/work",
  sessionName: "auto-develop-pr-7",
  timeoutMs: 10_000,
  pollIntervalMs: 1,
};

const emptyTailFs: TailFs = {
  makeTempDir: () => "/tmp/auto-develop-tmux-session",
  appendTarget: () => undefined,
  readFrom: () => "",
  readExitCode: () => 0,
  readAll: () => "",
  removeRecursive: () => undefined,
};

const collect = async (stream: AsyncGenerator<string, void, undefined>): Promise<string> => {
  const chunks = new Map<number, string>();
  for await (const chunk of stream) chunks.set(chunks.size, chunk);
  return [...chunks.values()].join("");
};

type ScriptedRun = {
  readonly output: string;
  readonly rejection: unknown;
  readonly execCalls: readonly string[];
  readonly removedDirs: readonly string[];
};

const runScripted = async (setup: {
  readonly script: SessionScript;
  readonly request: TmuxRunRequest;
}): Promise<ScriptedRun> => {
  const scripted = scriptedDeps(setup.script);
  try {
    const output = await collect(runInTmux(scripted.deps)(setup.request));
    return {
      output,
      rejection: undefined,
      execCalls: scripted.execArgs(),
      removedDirs: scripted.removed(),
    };
  } catch (streamFailure) {
    return {
      output: "",
      rejection: streamFailure,
      execCalls: scripted.execArgs(),
      removedDirs: scripted.removed(),
    };
  }
};

const runWithAbortedSignal = (): Promise<ScriptedRun> => {
  const abort = new AbortController();
  abort.abort(new Error("PR closed"));
  return runScripted({
    script: { aliveForChecks: 100, outputChunks: [""], exitCode: 0 },
    request: { ...baseRequest, signal: abort.signal },
  });
};

const runWithStaleSession = async (killExitCode: number): Promise<number> => {
  const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
  const counters = new Map<string, number>([["checks", 0]]);
  const exec: CommandExecutor = {
    run: (invocation) => {
      if (invocation.args[0] === "has-session") {
        const index = counters.get("checks") as number;
        counters.set("checks", index + 1);
        return Promise.resolve({ exitCode: index === 0 ? 0 : 1, stdout: "", stderr: "" });
      }
      if (invocation.args[0] === "kill-session") {
        return Promise.resolve({ exitCode: killExitCode, stdout: "", stderr: "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    },
  };
  await collect(
    runInTmux({
      exec,
      fs: emptyTailFs,
      now: () => 0,
      sleep: () => Promise.resolve(),
      log: { ...silentLogger, warn },
    })(baseRequest),
  );
  return warn.mock.calls.length;
};

const sleepCallsWithoutPollInterval = async (): Promise<readonly (readonly [number])[]> => {
  const counters = new Map<string, number>([["checks", 0]]);
  const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());
  const exec: CommandExecutor = {
    run: (invocation) => {
      if (invocation.args[0] === "has-session") {
        const index = counters.get("checks") as number;
        counters.set("checks", index + 1);
        if (index === 0) return Promise.resolve({ exitCode: 1, stdout: "", stderr: "" });
        return Promise.resolve({ exitCode: index === 1 ? 0 : 1, stdout: "", stderr: "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    },
  };
  const { pollIntervalMs: _pollIntervalMs, ...requestWithoutPoll } = baseRequest;
  await collect(
    runInTmux({ exec, fs: emptyTailFs, now: () => 0, sleep, log: silentLogger })(
      requestWithoutPoll,
    ),
  );
  return sleep.mock.calls;
};

const outputFlushedAtSessionEnd = (): Promise<string> => {
  const counters = new Map<string, number>([["checks", 0]]);
  const buffers = new Map([["out", ""]]);
  const exec: CommandExecutor = {
    run: (invocation) => {
      if (invocation.args[0] === "has-session") {
        const index = counters.get("checks") as number;
        counters.set("checks", index + 1);
        if (index === 0) return Promise.resolve({ exitCode: 1, stdout: "", stderr: "" });
        buffers.set("out", "final bytes\n");
        return Promise.resolve({ exitCode: 1, stdout: "", stderr: "" });
      }
      return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
    },
  };
  const fs: TailFs = {
    ...emptyTailFs,
    readFrom: ({ offset }) => (buffers.get("out") as string).slice(offset),
    readAll: () => buffers.get("out") as string,
  };
  return collect(
    runInTmux({ exec, fs, now: () => 0, sleep: () => Promise.resolve(), log: silentLogger })(
      baseRequest,
    ),
  );
};

const it = test
  .extend("startupRun", () =>
    runScripted({
      script: { aliveForChecks: 0, outputChunks: ["done\n"], exitCode: 0 },
      request: baseRequest,
    }))
  .extend("twoChunkRun", () =>
    runScripted({
      script: { aliveForChecks: 0, outputChunks: ["step 1\n", "step 2\n"], exitCode: 0 },
      request: baseRequest,
    }),
  )
  .extend("nonZeroExitRun", () =>
    runScripted({
      script: { aliveForChecks: 0, outputChunks: ["boom\n"], exitCode: 2 },
      request: baseRequest,
    }),
  )
  .extend("missingExitCodeRun", () =>
    runScripted({
      script: { aliveForChecks: 0, outputChunks: [""], exitCode: null },
      request: baseRequest,
    }),
  )
  .extend("timedOutRun", () =>
    runScripted({
      script: { aliveForChecks: 100, outputChunks: [""], exitCode: 0 },
      request: { ...baseRequest, timeoutMs: 0 },
    }),
  )
  .extend("unresponsiveRun", () =>
    runScripted({
      script: { aliveForChecks: 100, outputChunks: [""], exitCode: 0 },
      request: { ...baseRequest, timeoutMs: 1_000_000, idleTimeoutMs: 0 },
    }),
  )
  .extend("abortedRun", () => runWithAbortedSignal())
  .extend("cleanupRun", () =>
    runScripted({
      script: { aliveForChecks: 0, outputChunks: ["ok"], exitCode: 0 },
      request: baseRequest,
    }),
  )
  .extend("warningsForSuccessfulStaleKill", () => runWithStaleSession(0))
  .extend("warningsForFailingStaleKill", () => runWithStaleSession(1))
  .extend("defaultPollSleepCalls", () => sleepCallsWithoutPollInterval())
  .extend("flushedTailOutput", () => outputFlushedAtSessionEnd());

describe("runInTmux", () => {
  it("最初に残骸セッションの存在を確認する", ({ startupRun }) => {
    expect(startupRun.execCalls[0]).toMatch(/^tmux has-session/u);
  });

  it("存在確認の次にセッションを作成する", ({ startupRun }) => {
    expect(startupRun.execCalls[1]).toMatch(/^tmux new-session/u);
  });

  it("セッション作成の次に pipe-pane を張る", ({ startupRun }) => {
    expect(startupRun.execCalls[2]).toMatch(/^tmux pipe-pane/u);
  });

  it("正常完了時は捕捉された出力が断片の連結として得られる", ({ twoChunkRun }) => {
    expect(twoChunkRun.output).toStrictEqual("step 1\nstep 2\n");
  });

  it("非ゼロ終了はプロセス失敗エラーになる", ({ nonZeroExitRun }) => {
    expect(nonZeroExitRun.rejection).toBeInstanceOf(ProcessFailedError);
  });

  it("非ゼロ終了のエラーは終了コードを運ぶ", ({ nonZeroExitRun }) => {
    expect((nonZeroExitRun.rejection as ProcessFailedError).exitCode).toStrictEqual(2);
  });

  it("非ゼロ終了のエラーは出力全文を運ぶ", ({ nonZeroExitRun }) => {
    expect((nonZeroExitRun.rejection as ProcessFailedError).output).toStrictEqual("boom\n");
  });

  it("終了コードファイルが無ければ終了コード -1 として失敗する", ({ missingExitCodeRun }) => {
    expect((missingExitCodeRun.rejection as ProcessFailedError).exitCode).toStrictEqual(-1);
  });

  it("全体タイムアウト超過は素のエラーになる", ({ timedOutRun }) => {
    expect((timedOutRun.rejection as Error).message).toContain("exceeded the 0ms timeout");
  });

  it("全体タイムアウト超過はセッションを kill する", ({ timedOutRun }) => {
    expect(timedOutRun.execCalls).toContain("tmux kill-session -t auto-develop-pr-7");
  });

  it("無反応タイムアウトは専用型エラーになる", ({ unresponsiveRun }) => {
    expect(unresponsiveRun.rejection).toBeInstanceOf(UnresponsiveError);
  });

  it("中断シグナル発火時はシグナルの理由を投げ終了コードを見ない", ({ abortedRun }) => {
    expect((abortedRun.rejection as Error).message).toStrictEqual("PR closed");
  });

  it("どの経路でも一時ディレクトリが削除される", ({ cleanupRun }) => {
    expect(cleanupRun.removedDirs).toStrictEqual(["/tmp/auto-develop-tmux-session"]);
  });

  it("残骸セッションを検出したら kill が成功した場合は警告を出さない", ({
    warningsForSuccessfulStaleKill,
  }) => {
    expect(warningsForSuccessfulStaleKill).toStrictEqual(0);
  });

  it("残骸セッションの kill が失敗しても警告のみで続行する", ({ warningsForFailingStaleKill }) => {
    expect(warningsForFailingStaleKill).toStrictEqual(1);
  });

  it("ポーリング間隔を指定しなければ既定の間隔で待ってから次周する", ({
    defaultPollSleepCalls,
  }) => {
    expect(defaultPollSleepCalls).toStrictEqual([[200]]);
  });

  it("セッション終了時に残った最終バイトを読み切ってから正常終了する", ({ flushedTailOutput }) => {
    expect(flushedTailOutput).toStrictEqual("final bytes\n");
  });
});
