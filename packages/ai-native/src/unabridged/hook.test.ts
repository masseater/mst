import { describe, expect, test } from "vite-plus/test";

import { hook } from "./hook.ts";
import { denyReasonFor } from "./message.ts";

type Context = Parameters<typeof hook.run>[0];

const contextFor = (command: string): Context => ({
  input: {
    cwd: "/repo",
    hook_event_name: "PreToolUse",
    session_id: "session",
    tool_input: { command },
    tool_name: "Bash",
    tool_use_id: "toolu_1",
    transcript_path: "/repo/transcript.jsonl",
  },
  blockingError: (blockingMessage) => ({ kind: "blocking-error", payload: blockingMessage }),
  defer: (deferred, deferOptions) => ({
    kind: "json-async",
    run: deferred,
    timeoutMs: deferOptions?.timeoutMs,
  }),
  json: (jsonPayload) => ({ kind: "json-sync", payload: jsonPayload }),
  nonBlockingError: (warning) => ({ kind: "non-blocking-error", payload: warning }),
  success: (successPayload) => ({ kind: "success", payload: successPayload ?? {} }),
});

describe("unabridged hook", () => {
  test("拒否する判断は deny の permissionDecision と直し方の理由になる", async () => {
    const decision = await hook.run(contextFor("vp test | tail -50"));
    expect(decision).toStrictEqual({
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

  test("通す判断は success になり、判断の内容を持たない", async () => {
    const decision = await hook.run(contextFor("git rev-parse HEAD"));
    expect(decision).toStrictEqual({ kind: "success", payload: {} });
  });
});
