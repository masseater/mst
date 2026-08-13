import { describe, expect, test } from "vite-plus/test";

import { hook } from "./hook.ts";
import { denyReasonFor } from "./message.ts";

describe("unabridged hook", () => {
  describe("出力を tail で切り落とす Bash コマンド", () => {
    const it = test.extend("decisionForASlicedCommand", async () =>
      hook.run({
        input: {
          cwd: "/repo",
          hook_event_name: "PreToolUse",
          session_id: "session",
          tool_input: { command: "vp test | tail -50" },
          tool_name: "Bash",
          tool_use_id: "toolu_1",
          transcript_path: "/repo/transcript.jsonl",
        },
        blockingError: (blockingMessage) => ({ kind: "blocking-error", payload: blockingMessage }),
        defer: (deferred, deferSettings) => ({
          kind: "json-async",
          run: deferred,
          timeoutMs: deferSettings?.timeoutMs,
        }),
        json: (jsonPayload) => ({ kind: "json-sync", payload: jsonPayload }),
        nonBlockingError: (warning) => ({ kind: "non-blocking-error", payload: warning }),
        success: (successPayload) => ({ kind: "success", payload: successPayload ?? {} }),
      }));

    it("拒否する判断は deny の permissionDecision と直し方の理由になる", ({
      decisionForASlicedCommand,
    }) => {
      expect(decisionForASlicedCommand).toStrictEqual({
        kind: "json-sync",
        payload: {
          event: "PreToolUse",
          output: {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: denyReasonFor(["tail"]),
            },
          },
        },
      });
    });
  });

  describe("出力を切り落とさない Bash コマンド", () => {
    const it = test.extend("decisionForAWholeCommand", async () =>
      hook.run({
        input: {
          cwd: "/repo",
          hook_event_name: "PreToolUse",
          session_id: "session",
          tool_input: { command: "git rev-parse HEAD" },
          tool_name: "Bash",
          tool_use_id: "toolu_1",
          transcript_path: "/repo/transcript.jsonl",
        },
        blockingError: (blockingMessage) => ({ kind: "blocking-error", payload: blockingMessage }),
        defer: (deferred, deferSettings) => ({
          kind: "json-async",
          run: deferred,
          timeoutMs: deferSettings?.timeoutMs,
        }),
        json: (jsonPayload) => ({ kind: "json-sync", payload: jsonPayload }),
        nonBlockingError: (warning) => ({ kind: "non-blocking-error", payload: warning }),
        success: (successPayload) => ({ kind: "success", payload: successPayload ?? {} }),
      }));

    it("通す判断は success になり、判断の内容を持たない", ({ decisionForAWholeCommand }) => {
      expect(decisionForAWholeCommand).toStrictEqual({ kind: "success", payload: {} });
    });
  });
});
