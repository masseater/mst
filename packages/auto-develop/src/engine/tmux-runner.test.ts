import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger, type Logger } from "../logging/logger.ts";
import { ProcessFailedError } from "./process-failed-error.ts";
import { runInTmux, type TmuxRunnerDeps, type TmuxRunRequest } from "./tmux-runner.ts";
import { UnresponsiveError } from "./unresponsive-error.ts";

import type { CommandExecutor, TailFs } from "./command-executor.ts";

const baseRequest: TmuxRunRequest = {
  binary: "claude",
  args: ["-p", "hello"],
  cwd: "/work",
  sessionName: "auto-develop-pr-7",
  timeoutMs: 10_000,
};

describe("runInTmux", () => {
  const it = test
    .extend("startupCommands", async () => {
      const runCommand = vi.fn<CommandExecutor["run"]>(() =>
        Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }),
      );
      await Array.fromAsync(
        runInTmux({
          exec: { run: runCommand },
          fs: {
            makeTempDir: () => "/tmp/auto-develop-tmux",
            appendTarget: () => undefined,
            readFrom: () => "",
            readExitCode: () => 0,
            readAll: () => "",
            removeRecursive: () => undefined,
          },
          now: () => 0,
          sleep: () => Promise.resolve(),
          log: silentLogger,
        })(baseRequest),
      );
      return runCommand;
    })
    .extend("chunkedOutput", () => {
      const producedChunks = ["step 1\n", "step 2\n"].values();
      return Array.fromAsync(
        runInTmux({
          exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
          fs: {
            makeTempDir: () => "/tmp/auto-develop-tmux",
            appendTarget: () => undefined,
            readFrom: () => producedChunks.next().value ?? "",
            readExitCode: () => 0,
            readAll: () => "",
            removeRecursive: () => undefined,
          },
          now: () => 0,
          sleep: () => Promise.resolve(),
          log: silentLogger,
        })(baseRequest),
      );
    })
    .extend("nonZeroExitFailure", async () => {
      try {
        await Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => 2,
              readAll: () => "boom\n",
              removeRecursive: () => undefined,
            },
            now: () => 0,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })(baseRequest),
        );
      } catch (streamFailure) {
        return streamFailure;
      }
      throw new Error("the run was expected to reject");
    })
    .extend("unusualExitCodeFailure", async () => {
      try {
        await Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => 42,
              readAll: () => "",
              removeRecursive: () => undefined,
            },
            now: () => 0,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })(baseRequest),
        );
      } catch (streamFailure) {
        return streamFailure;
      }
      throw new Error("the run was expected to reject");
    })
    .extend("fullOutputFailure", async () => {
      const producedChunks = ["step 1\n", "step 2\n"].values();
      try {
        await Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => producedChunks.next().value ?? "",
              readExitCode: () => 3,
              readAll: () => "step 1\nstep 2\n",
              removeRecursive: () => undefined,
            },
            now: () => 0,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })(baseRequest),
        );
      } catch (streamFailure) {
        return streamFailure;
      }
      throw new Error("the run was expected to reject");
    })
    .extend("missingExitCodeFailure", async () => {
      try {
        await Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => null,
              readAll: () => "",
              removeRecursive: () => undefined,
            },
            now: () => 0,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })(baseRequest),
        );
      } catch (streamFailure) {
        return streamFailure;
      }
      throw new Error("the run was expected to reject");
    })
    .extend("timedOutFailure", async () => {
      const ticks = [0].values();
      try {
        await Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => 0,
              readAll: () => "",
              removeRecursive: () => undefined,
            },
            now: () => ticks.next().value ?? 1,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })({ ...baseRequest, timeoutMs: 0 }),
        );
      } catch (streamFailure) {
        return streamFailure;
      }
      throw new Error("the run was expected to reject");
    })
    .extend("timedOutCommands", async () => {
      const ticks = [0].values();
      const runCommand = vi.fn<CommandExecutor["run"]>(() =>
        Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }),
      );
      await Promise.allSettled([
        Array.fromAsync(
          runInTmux({
            exec: { run: runCommand },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => 0,
              readAll: () => "",
              removeRecursive: () => undefined,
            },
            now: () => ticks.next().value ?? 1,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })({ ...baseRequest, timeoutMs: 0 }),
        ),
      ]);
      return runCommand;
    })
    .extend("unresponsiveFailure", async () => {
      const ticks = [0].values();
      try {
        await Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => 0,
              readAll: () => "",
              removeRecursive: () => undefined,
            },
            now: () => ticks.next().value ?? 1,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })({ ...baseRequest, timeoutMs: 1_000_000, idleTimeoutMs: 0 }),
        );
      } catch (streamFailure) {
        return streamFailure;
      }
      throw new Error("the run was expected to reject");
    })
    .extend("abortedFailure", async () => {
      const pullRequestClosed = new AbortController();
      pullRequestClosed.abort(new Error("PR closed"));
      try {
        await Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => 7,
              readAll: () => "",
              removeRecursive: () => undefined,
            },
            now: () => 0,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })({ ...baseRequest, signal: pullRequestClosed.signal }),
        );
      } catch (streamFailure) {
        return streamFailure;
      }
      throw new Error("the run was expected to reject");
    })
    .extend("removedTempDir", async () => {
      const removeRecursive = vi.fn<TailFs["removeRecursive"]>();
      await Promise.allSettled([
        Array.fromAsync(
          runInTmux({
            exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
            fs: {
              makeTempDir: () => "/tmp/auto-develop-tmux",
              appendTarget: () => undefined,
              readFrom: () => "",
              readExitCode: () => 9,
              readAll: () => "",
              removeRecursive,
            },
            now: () => 0,
            sleep: () => Promise.resolve(),
            log: silentLogger,
          })(baseRequest),
        ),
      ]);
      return removeRecursive;
    })
    .extend("warningsAfterSuccessfulStaleKill", async () => {
      const sessionChecks = [0, 1].values();
      const warn = vi.fn<Logger["warn"]>();
      await Array.fromAsync(
        runInTmux({
          exec: {
            run: ({ args }) =>
              Promise.resolve({
                exitCode: args[0] === "has-session" ? (sessionChecks.next().value ?? 1) : 0,
                stdout: "",
                stderr: "",
              }),
          },
          fs: {
            makeTempDir: () => "/tmp/auto-develop-tmux",
            appendTarget: () => undefined,
            readFrom: () => "",
            readExitCode: () => 0,
            readAll: () => "",
            removeRecursive: () => undefined,
          },
          now: () => 0,
          sleep: () => Promise.resolve(),
          log: { ...silentLogger, warn },
        })(baseRequest),
      );
      return warn;
    })
    .extend("warningsAfterFailingStaleKill", async () => {
      const sessionChecks = [0, 1].values();
      const warn = vi.fn<Logger["warn"]>();
      await Array.fromAsync(
        runInTmux({
          exec: {
            run: ({ args }) =>
              Promise.resolve({
                exitCode: args[0] === "has-session" ? (sessionChecks.next().value ?? 1) : 1,
                stdout: "",
                stderr: "",
              }),
          },
          fs: {
            makeTempDir: () => "/tmp/auto-develop-tmux",
            appendTarget: () => undefined,
            readFrom: () => "",
            readExitCode: () => 0,
            readAll: () => "",
            removeRecursive: () => undefined,
          },
          now: () => 0,
          sleep: () => Promise.resolve(),
          log: { ...silentLogger, warn },
        })(baseRequest),
      );
      return warn;
    })
    .extend("defaultPollSleeps", async () => {
      const sessionChecks = [1, 0, 1].values();
      const sleep = vi.fn<TmuxRunnerDeps["sleep"]>(() => Promise.resolve());
      await Array.fromAsync(
        runInTmux({
          exec: {
            run: ({ args }) =>
              Promise.resolve({
                exitCode: args[0] === "has-session" ? (sessionChecks.next().value ?? 1) : 0,
                stdout: "",
                stderr: "",
              }),
          },
          fs: {
            makeTempDir: () => "/tmp/auto-develop-tmux",
            appendTarget: () => undefined,
            readFrom: () => "",
            readExitCode: () => 0,
            readAll: () => "",
            removeRecursive: () => undefined,
          },
          now: () => 0,
          sleep,
          log: silentLogger,
        })(baseRequest),
      );
      return sleep;
    })
    .extend("flushedTailOutput", () => {
      const producedChunks = ["", "final bytes\n"].values();
      return Array.fromAsync(
        runInTmux({
          exec: { run: () => Promise.resolve({ exitCode: 1, stdout: "", stderr: "" }) },
          fs: {
            makeTempDir: () => "/tmp/auto-develop-tmux",
            appendTarget: () => undefined,
            readFrom: () => producedChunks.next().value ?? "",
            readExitCode: () => 0,
            readAll: () => "",
            removeRecursive: () => undefined,
          },
          now: () => 0,
          sleep: () => Promise.resolve(),
          log: silentLogger,
        })(baseRequest),
      );
    });

  it("最初に残骸セッションの存在を確認する", ({ startupCommands }) => {
    expect(startupCommands).toHaveBeenNthCalledWith(1, {
      binary: "tmux",
      args: ["has-session", "-t", "auto-develop-pr-7"],
    });
  });

  it("存在確認の次にセッションを作成する", ({ startupCommands }) => {
    expect(startupCommands).toHaveBeenNthCalledWith(2, {
      binary: "tmux",
      args: [
        "new-session",
        "-d",
        "-s",
        "auto-develop-pr-7",
        "-c",
        "/work",
        "sh",
        "-c",
        `'claude' '-p' 'hello'; printf '%s' "$?" > '/tmp/auto-develop-tmux/exit'`,
      ],
    });
  });

  it("セッション作成の次に pipe-pane を張る", ({ startupCommands }) => {
    expect(startupCommands).toHaveBeenNthCalledWith(3, {
      binary: "tmux",
      args: [
        "pipe-pane",
        "-t",
        "auto-develop-pr-7",
        "-o",
        "cat >> '/tmp/auto-develop-tmux/out.log'",
      ],
    });
  });

  it("正常完了時は捕捉された出力が断片のまま順に届く", ({ chunkedOutput }) => {
    expect(chunkedOutput).toStrictEqual(["step 1\n", "step 2\n"]);
  });

  it("非ゼロ終了はプロセス失敗エラーになる", ({ nonZeroExitFailure }) => {
    expect(nonZeroExitFailure).toStrictEqual(
      new ProcessFailedError({ command: "claude", exitCode: 2, output: "boom\n" }),
    );
  });

  it("非ゼロ終了のエラーは終了コードをそのまま運ぶ", ({ unusualExitCodeFailure }) => {
    expect(unusualExitCodeFailure).toStrictEqual(
      new ProcessFailedError({ command: "claude", exitCode: 42, output: "" }),
    );
  });

  it("非ゼロ終了のエラーは出力全文を運ぶ", ({ fullOutputFailure }) => {
    expect(fullOutputFailure).toStrictEqual(
      new ProcessFailedError({ command: "claude", exitCode: 3, output: "step 1\nstep 2\n" }),
    );
  });

  it("終了コードファイルが無ければ終了コード -1 として失敗する", ({ missingExitCodeFailure }) => {
    expect(missingExitCodeFailure).toStrictEqual(
      new ProcessFailedError({ command: "claude", exitCode: -1, output: "" }),
    );
  });

  it("全体タイムアウト超過は素のエラーになる", ({ timedOutFailure }) => {
    expect(timedOutFailure).toStrictEqual(new Error("engine run exceeded the 0ms timeout"));
  });

  it("全体タイムアウト超過はセッションを kill する", ({ timedOutCommands }) => {
    expect(timedOutCommands).toHaveBeenLastCalledWith({
      binary: "tmux",
      args: ["kill-session", "-t", "auto-develop-pr-7"],
    });
  });

  it("無反応タイムアウトは専用型エラーになる", ({ unresponsiveFailure }) => {
    expect(unresponsiveFailure).toStrictEqual(
      new UnresponsiveError({ command: "claude", idleMs: 0 }),
    );
  });

  it("中断シグナル発火時はシグナルの理由を投げ終了コードを見ない", ({ abortedFailure }) => {
    expect(abortedFailure).toStrictEqual(new Error("PR closed"));
  });

  it("どの経路でも一時ディレクトリが削除される", ({ removedTempDir }) => {
    expect(removedTempDir).toHaveBeenCalledExactlyOnceWith("/tmp/auto-develop-tmux");
  });

  it("残骸セッションの kill が成功した場合は警告を出さない", ({
    warningsAfterSuccessfulStaleKill,
  }) => {
    expect(warningsAfterSuccessfulStaleKill).toHaveBeenCalledTimes(0);
  });

  it("残骸セッションの kill が失敗しても警告のみで続行する", ({
    warningsAfterFailingStaleKill,
  }) => {
    expect(warningsAfterFailingStaleKill).toHaveBeenCalledExactlyOnceWith(
      { sessionName: "auto-develop-pr-7" },
      "killing a stale tmux session failed",
    );
  });

  it("ポーリング間隔を指定しなければ既定の間隔で待ってから次周する", ({ defaultPollSleeps }) => {
    expect(defaultPollSleeps).toHaveBeenCalledExactlyOnceWith(200);
  });

  it("セッション終了時に残った最終バイトを読み切ってから正常終了する", ({ flushedTailOutput }) => {
    expect(flushedTailOutput).toStrictEqual(["final bytes\n"]);
  });
});
