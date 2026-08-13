import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { describe, expect, test, vi } from "vite-plus/test";

import { denyReasonFor } from "./message.ts";

const { runHookMock } = vi.hoisted(() => ({ runHookMock: vi.fn<() => Promise<void>>() }));

vi.mock(import("cc-hooks-ts"), async (importOriginal) => ({
  ...(await importOriginal()),
  runHook: runHookMock,
}));

const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));

const payloadFor = (command: string): string =>
  JSON.stringify({
    cwd: "/repo",
    hook_event_name: "PreToolUse",
    session_id: "session",
    tool_input: { command },
    tool_name: "Bash",
    tool_use_id: "toolu_1",
    transcript_path: "/repo/transcript.jsonl",
  });

const runCli = (command: string) =>
  spawnSync(process.execPath, [cliPath], {
    encoding: "utf8" as const,
    input: payloadFor(command),
  });

describe("unabridged cli", () => {
  test("エントリは hook 定義を runHook に渡す", async () => {
    await import("./cli.ts");
    const { hook } = await import("./hook.ts");
    expect(runHookMock).toHaveBeenCalledWith(hook);
  });

  test("標準入力の PreToolUse を読み、拒否の判断を標準出力へ返す", { timeout: 30_000 }, () => {
    const execution = runCli("vp test | tail -50");
    expect(execution.status).toBe(0);
    const decision: unknown = JSON.parse(execution.stdout);
    expect(decision).toStrictEqual({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: denyReasonFor(["tail"]),
      },
    });
  });

  test("通す判断のときは標準出力に何も出さない", { timeout: 30_000 }, () => {
    const execution = runCli("git rev-parse HEAD");
    expect(execution.status).toBe(0);
    expect(execution.stdout).toBe("");
  });
});
