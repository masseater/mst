import { defineHook } from "cc-hooks-ts";

import { denyReasonOf } from "./deny-reason.ts";

export const hook: ReturnType<typeof defineHook<{ PreToolUse: true }>> = defineHook({
  trigger: { PreToolUse: true },
  run: (hookContext) => {
    const refusal = denyReasonOf(hookContext.input.tool_name, hookContext.input.tool_input);
    if (refusal === undefined) {
      return hookContext.success({});
    }
    return hookContext.json({
      event: "PreToolUse",
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: refusal,
        },
      },
    });
  },
});
