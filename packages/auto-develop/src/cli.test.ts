import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vite-plus/test";

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

describe("auto-develop cli entrypoint", () => {
  const it = test
    .extend("helpError", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "--help"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "error",
      ))
    .extend("helpSignal", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "--help"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "signal",
      ),
    )
    .extend("helpStatus", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "--help"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "status",
      ),
    )
    .extend("helpStdout", () =>
      JSON.stringify(
        Reflect.get(
          spawnSync(process.execPath, [CLI_PATH, "--help"], {
            encoding: "utf8",
            env: process.env,
            killSignal: "SIGKILL",
            timeout: 10_000,
          }),
          "stdout",
        ),
      ),
    )
    .extend("helpStderr", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "--help"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "stderr",
      ),
    )
    .extend("unknownCommandError", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "not-a-command"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "error",
      ),
    )
    .extend("unknownCommandSignal", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "not-a-command"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "signal",
      ),
    )
    .extend("unknownCommandStatus", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "not-a-command"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "status",
      ),
    )
    .extend("unknownCommandStdout", () =>
      JSON.stringify(
        Reflect.get(
          spawnSync(process.execPath, [CLI_PATH, "not-a-command"], {
            encoding: "utf8",
            env: process.env,
            killSignal: "SIGKILL",
            timeout: 10_000,
          }),
          "stdout",
        ),
      ),
    )
    .extend("unknownCommandStderr", () =>
      Reflect.get(
        spawnSync(process.execPath, [CLI_PATH, "not-a-command"], {
          encoding: "utf8",
          env: process.env,
          killSignal: "SIGKILL",
          timeout: 10_000,
        }),
        "stderr",
      ),
    );

  it("--help の実プロセスは起動に失敗しない", { timeout: 15_000 }, ({ helpError }) => {
    expect(helpError).toBe(undefined);
  });

  it("--help の実プロセスはシグナル終了しない", { timeout: 15_000 }, ({ helpSignal }) => {
    expect(helpSignal).toBe(null);
  });

  it("--help の実プロセスは 0 で終わる", { timeout: 15_000 }, ({ helpStatus }) => {
    expect(helpStatus).toBe(0);
  });

  it("--help はサブコマンドを標準出力に列挙する", { timeout: 15_000 }, ({ helpStdout }) => {
    expect(helpStdout).toMatchInlineSnapshot(
      `""Keep a pull-request review loop running without a human starting it. (auto-develop)\\n\\nUSAGE auto-develop reviewer|author|build-pr-context\\n\\nCOMMANDS\\n\\n          reviewer    Review pull requests as they are requested.                         \\n            author    Answer review feedback, CI failures and base updates.               \\n  build-pr-context    Collect the PR context into JSON and Markdown for the agent to read.\\n\\nUse auto-develop <command> --help for more information about a command.\\n\\n""`,
    );
  });

  it("--help は標準エラーを空に保つ", { timeout: 15_000 }, ({ helpStderr }) => {
    expect(helpStderr).toBe("");
  });

  it(
    "未知の argv の実プロセスは起動に失敗しない",
    { timeout: 15_000 },
    ({ unknownCommandError }) => {
      expect(unknownCommandError).toBe(undefined);
    },
  );

  it(
    "未知の argv の実プロセスはシグナル終了しない",
    { timeout: 15_000 },
    ({ unknownCommandSignal }) => {
      expect(unknownCommandSignal).toBe(null);
    },
  );

  it("未知の argv の実プロセスは 1 で終わる", { timeout: 15_000 }, ({ unknownCommandStatus }) => {
    expect(unknownCommandStatus).toBe(1);
  });

  it("未知の argv は使用法を標準出力に出す", { timeout: 15_000 }, ({ unknownCommandStdout }) => {
    expect(unknownCommandStdout).toMatchInlineSnapshot(
      `""Keep a pull-request review loop running without a human starting it. (auto-develop)\\n\\nUSAGE auto-develop reviewer|author|build-pr-context\\n\\nCOMMANDS\\n\\n          reviewer    Review pull requests as they are requested.                         \\n            author    Answer review feedback, CI failures and base updates.               \\n  build-pr-context    Collect the PR context into JSON and Markdown for the agent to read.\\n\\nUse auto-develop <command> --help for more information about a command.\\n\\n""`,
    );
  });

  it("未知の argv は診断を標準エラーに出す", { timeout: 15_000 }, ({ unknownCommandStderr }) => {
    expect(unknownCommandStderr).toMatchInlineSnapshot(`
      "Unknown command not-a-command
      "
    `);
  });
});
