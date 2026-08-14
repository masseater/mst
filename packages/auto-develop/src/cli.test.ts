import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import type { CommandDef } from "citty";

const runMainMock = vi.hoisted(() =>
  vi.fn<(command: CommandDef) => Promise<void>>(() => Promise.resolve()),
);

vi.mock(import("citty"), async (importOriginal) => {
  const real = await importOriginal();
  const runMain = ((...call: Parameters<typeof real.runMain>) =>
    runMainMock(call[0])) as typeof real.runMain;
  return { ...real, runMain };
});

const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));

const invoke = (args: readonly string[]) =>
  spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8" as const,
    env: process.env,
    killSignal: "SIGKILL",
    timeout: 10_000,
  });

describe("auto-develop cli entrypoint", () => {
  test("citty にルートコマンドを渡して完了を待つ", async () => {
    onTestFinished(() => {
      runMainMock.mockClear();
    });

    await import("./cli.ts");

    expect(runMainMock).toHaveBeenCalledOnce();
    expect(runMainMock.mock.calls[0]?.[0].meta).toStrictEqual({
      name: "auto-develop",
      description: "Keep a pull-request review loop running without a human starting it.",
    });
    expect(Object.keys(runMainMock.mock.calls[0]?.[0].subCommands ?? {})).toStrictEqual([
      "reviewer",
      "author",
      "build-pr-context",
    ]);
  });

  test(
    "--help は実プロセスの標準出力にサブコマンドを列挙して 0 で終わる",
    { timeout: 15_000 },
    () => {
      const execution = invoke(["--help"]);

      expect(execution.error).toBeUndefined();
      expect(execution.signal).toBeNull();
      expect(execution.status).toBe(0);
      expect(execution.stdout).toContain("USAGE auto-develop reviewer|author|build-pr-context");
      expect(execution.stdout).toContain("build-pr-context");
      expect(execution.stderr).toBe("");
    },
  );

  test("未知の argv は実プロセスの stderr に診断を出して 1 で終わる", { timeout: 15_000 }, () => {
    const execution = invoke(["not-a-command"]);

    expect(execution.error).toBeUndefined();
    expect(execution.signal).toBeNull();
    expect(execution.status).toBe(1);
    expect(execution.stdout).toContain("USAGE auto-develop reviewer|author|build-pr-context");
    expect(execution.stderr).toContain("Unknown command not-a-command");
  });
});
