import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { runHook } from "cc-hooks-ts";
import { describe, expect, test, vi } from "vite-plus/test";

import { hook } from "./hook.ts";
import { denyReasonFor } from "./message.ts";

vi.mock(import("cc-hooks-ts"), { spy: true });

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

const SLICING_COMMAND_PAYLOAD = JSON.stringify({
  cwd: "/repo",
  hook_event_name: "PreToolUse",
  session_id: "session",
  tool_input: { command: "vp test | tail -50" },
  tool_name: "Bash",
  tool_use_id: "toolu_1",
  transcript_path: "/repo/transcript.jsonl",
});

const WHOLE_RECORD_COMMAND_PAYLOAD = JSON.stringify({
  cwd: "/repo",
  hook_event_name: "PreToolUse",
  session_id: "session",
  tool_input: { command: "git rev-parse HEAD" },
  tool_name: "Bash",
  tool_use_id: "toolu_1",
  transcript_path: "/repo/transcript.jsonl",
});

describe("unabridged cli", () => {
  describe("the entry module", () => {
    const it = test.extend("theRunnerTheEntryReached", async () => {
      const runner = vi.mocked(runHook);
      runner.mockResolvedValue(undefined);
      await import("./cli.ts");
      return runner;
    });

    it("is handed the hook definition of this package", ({ theRunnerTheEntryReached }) => {
      expect(theRunnerTheEntryReached).toHaveBeenCalledExactlyOnceWith(hook);
    });
  });

  describe("a Bash command slicing the record it reads", () => {
    const it = test
      .extend("theRunOverASlicingCommand", () =>
        spawnSync(process.execPath, [CLI_PATH], {
          encoding: "utf8",
          input: SLICING_COMMAND_PAYLOAD,
        }))
      .extend("theExitCodeOverASlicingCommand", ({ theRunOverASlicingCommand }) => {
        const { status } = theRunOverASlicingCommand;
        return status;
      })
      .extend("theDecisionOverASlicingCommand", (): unknown =>
        JSON.parse(
          spawnSync(process.execPath, [CLI_PATH], {
            encoding: "utf8",
            input: SLICING_COMMAND_PAYLOAD,
          }).stdout,
        ),
      );

    it(
      "ends on the code of a hook that finished",
      { timeout: 30_000 },
      ({ theExitCodeOverASlicingCommand }) => {
        expect(theExitCodeOverASlicingCommand).toBe(0);
      },
    );

    it(
      "puts the refusal and the way out of it on standard output",
      { timeout: 30_000 },
      ({ theDecisionOverASlicingCommand }) => {
        expect(theDecisionOverASlicingCommand).toStrictEqual({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: denyReasonFor(["tail"]),
          },
        });
      },
    );
  });

  describe("a Bash command reading the whole record", () => {
    const it = test
      .extend("theRunOverAWholeRecordCommand", () =>
        spawnSync(process.execPath, [CLI_PATH], {
          encoding: "utf8",
          input: WHOLE_RECORD_COMMAND_PAYLOAD,
        }))
      .extend("theExitCodeOverAWholeRecordCommand", ({ theRunOverAWholeRecordCommand }) => {
        const { status } = theRunOverAWholeRecordCommand;
        return status;
      })
      .extend("theStandardOutputOverAWholeRecordCommand", ({ theRunOverAWholeRecordCommand }) => {
        const { stdout } = theRunOverAWholeRecordCommand;
        return stdout;
      });

    it(
      "ends on the code of a hook that finished",
      { timeout: 30_000 },
      ({ theExitCodeOverAWholeRecordCommand }) => {
        expect(theExitCodeOverAWholeRecordCommand).toBe(0);
      },
    );

    it(
      "leaves standard output empty",
      { timeout: 30_000 },
      ({ theStandardOutputOverAWholeRecordCommand }) => {
        expect(theStandardOutputOverAWholeRecordCommand).toBe("");
      },
    );
  });
});
