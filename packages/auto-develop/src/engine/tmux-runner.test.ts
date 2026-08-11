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

const collect = async (stream: AsyncGenerator<string, void, undefined>): Promise<string> => {
  const chunks = new Map<number, string>();
  for await (const chunk of stream) chunks.set(chunks.size, chunk);
  return [...chunks.values()].join("");
};

const rejectionOf = async (stream: AsyncGenerator<string, void, undefined>): Promise<unknown> => {
  try {
    await collect(stream);
    return undefined;
  } catch (streamFailure) {
    return streamFailure;
  }
};

describe("runInTmux", () => {
  test("残骸セッションの存在確認 → kill → 作成 → pipe-pane の順で呼ぶ", async () => {
    const scripted = scriptedDeps({ aliveForChecks: 0, outputChunks: ["done\n"], exitCode: 0 });
    await collect(runInTmux(scripted.deps)(baseRequest));
    const orderedCalls = scripted.execArgs();
    expect([
      orderedCalls[0]?.startsWith("tmux has-session"),
      orderedCalls[1]?.startsWith("tmux new-session"),
      orderedCalls[2]?.startsWith("tmux pipe-pane"),
    ]).toStrictEqual([true, true, true]);
  });

  test("正常完了時は捕捉された出力が断片の連結として得られる", async () => {
    const scripted = scriptedDeps({
      aliveForChecks: 0,
      outputChunks: ["step 1\n", "step 2\n"],
      exitCode: 0,
    });
    expect(await collect(runInTmux(scripted.deps)(baseRequest))).toStrictEqual("step 1\nstep 2\n");
  });

  test("非ゼロ終了は出力全文を運ぶプロセス失敗エラーになる", async () => {
    const scripted = scriptedDeps({ aliveForChecks: 0, outputChunks: ["boom\n"], exitCode: 2 });
    const rejection = await rejectionOf(runInTmux(scripted.deps)(baseRequest));
    expect([
      rejection instanceof ProcessFailedError,
      (rejection as ProcessFailedError).exitCode,
      (rejection as ProcessFailedError).output,
    ]).toStrictEqual([true, 2, "boom\n"]);
  });

  test("終了コードファイルが無ければ終了コード -1 として失敗する", async () => {
    const scripted = scriptedDeps({ aliveForChecks: 0, outputChunks: [""], exitCode: null });
    const rejection = await rejectionOf(runInTmux(scripted.deps)(baseRequest));
    expect((rejection as ProcessFailedError).exitCode).toStrictEqual(-1);
  });

  test("全体タイムアウト超過はセッションを kill して素のエラーになる", async () => {
    const scripted = scriptedDeps({ aliveForChecks: 100, outputChunks: [""], exitCode: 0 });
    await expect(
      collect(runInTmux(scripted.deps)({ ...baseRequest, timeoutMs: 0 })),
    ).rejects.toThrow("exceeded the 0ms timeout");
    expect(scripted.execArgs().some((call) => call.startsWith("tmux kill-session"))).toStrictEqual(
      true,
    );
  });

  test("無反応タイムアウトは専用型エラーになる", async () => {
    const scripted = scriptedDeps({ aliveForChecks: 100, outputChunks: [""], exitCode: 0 });
    await expect(
      collect(runInTmux(scripted.deps)({ ...baseRequest, timeoutMs: 1_000_000, idleTimeoutMs: 0 })),
    ).rejects.toThrow(UnresponsiveError);
  });

  test("中断シグナル発火時はシグナルの理由を投げ終了コードを見ない", async () => {
    const scripted = scriptedDeps({ aliveForChecks: 100, outputChunks: [""], exitCode: 0 });
    const abort = new AbortController();
    abort.abort(new Error("PR closed"));
    await expect(
      collect(runInTmux(scripted.deps)({ ...baseRequest, signal: abort.signal })),
    ).rejects.toThrow("PR closed");
  });

  test("どの経路でも一時ディレクトリが削除される", async () => {
    const scripted = scriptedDeps({ aliveForChecks: 0, outputChunks: ["ok"], exitCode: 0 });
    await collect(runInTmux(scripted.deps)(baseRequest));
    expect(scripted.removed()).toStrictEqual(["/tmp/auto-develop-tmux-session"]);
  });

  test("残骸セッションを検出したら kill が成功した場合は警告を出さない", async () => {
    const warn = vi.fn<(fields: Readonly<Record<string, unknown>>, message: string) => void>();
    const counters = new Map<string, number>([["checks", 0]]);
    const exec: CommandExecutor = {
      run: (invocation) => {
        if (invocation.args[0] === "has-session") {
          const index = counters.get("checks") as number;
          counters.set("checks", index + 1);
          return Promise.resolve({ exitCode: index === 0 ? 0 : 1, stdout: "", stderr: "" });
        }
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      },
    };
    const fs: TailFs = {
      makeTempDir: () => "/tmp/auto-develop-tmux-session",
      appendTarget: () => undefined,
      readFrom: () => "",
      readExitCode: () => 0,
      readAll: () => "",
      removeRecursive: () => undefined,
    };
    await collect(
      runInTmux({
        exec,
        fs,
        now: () => 0,
        sleep: () => Promise.resolve(),
        log: { ...silentLogger, warn },
      })(baseRequest),
    );
    expect(warn.mock.calls).toStrictEqual([]);
  });

  test("ポーリング間隔を指定しなければ既定の間隔で待ってから次周する", async () => {
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
    const fs: TailFs = {
      makeTempDir: () => "/tmp/auto-develop-tmux-session",
      appendTarget: () => undefined,
      readFrom: () => "",
      readExitCode: () => 0,
      readAll: () => "",
      removeRecursive: () => undefined,
    };
    const { pollIntervalMs: _pollIntervalMs, ...requestWithoutPoll } = baseRequest;
    await collect(
      runInTmux({ exec, fs, now: () => 0, sleep, log: silentLogger })(requestWithoutPoll),
    );
    expect(sleep.mock.calls).toStrictEqual([[200]]);
  });

  test("セッション終了時に残った最終バイトを読み切ってから正常終了する", async () => {
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
      makeTempDir: () => "/tmp/auto-develop-tmux-session",
      appendTarget: () => undefined,
      readFrom: ({ offset }) => (buffers.get("out") as string).slice(offset),
      readExitCode: () => 0,
      readAll: () => buffers.get("out") as string,
      removeRecursive: () => undefined,
    };
    const output = await collect(
      runInTmux({ exec, fs, now: () => 0, sleep: () => Promise.resolve(), log: silentLogger })(
        baseRequest,
      ),
    );
    expect(output).toStrictEqual("final bytes\n");
  });

  test("残骸セッションの kill が失敗しても警告のみで続行する", async () => {
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
          return Promise.resolve({ exitCode: 1, stdout: "", stderr: "" });
        }
        return Promise.resolve({ exitCode: 0, stdout: "", stderr: "" });
      },
    };
    const fs: TailFs = {
      makeTempDir: () => "/tmp/auto-develop-tmux-session",
      appendTarget: () => undefined,
      readFrom: () => "",
      readExitCode: () => 0,
      readAll: () => "",
      removeRecursive: () => undefined,
    };
    await collect(
      runInTmux({
        exec,
        fs,
        now: () => 0,
        sleep: () => Promise.resolve(),
        log: { ...silentLogger, warn },
      })(baseRequest),
    );
    expect(warn.mock.calls.length).toStrictEqual(1);
  });
});
