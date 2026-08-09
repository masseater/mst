import { describe } from "vite-plus/test";

import { createWorkspaceLintRule } from "./create-workspace-lint-rule.ts";
import { testLintRule } from "./rule-tester.ts";

const createRule = createWorkspaceLintRule({ workspaceDir: "packages/lint-rule-authoring" });

const noDebugger = createRule({
  name: "smoke-no-debugger",
  meta: {
    type: "problem",
    docs: {
      description: "Report every debugger statement.",
      relatedGuidelines: [],
    },
    messages: {
      debuggerFound: "Remove this debugger statement.",
    },
    schema: [],
  },
  create(context) {
    return {
      DebuggerStatement(node) {
        context.report({ node, messageId: "debuggerFound" });
      },
    };
  },
});

describe("testLintRule drives the oxlint rule tester", () => {
  testLintRule(noDebugger, {
    valid: [{ name: "code without a debugger statement passes", code: "const answer = 1;" }],
    invalid: [
      {
        name: "a debugger statement is reported",
        code: "debugger;",
        errors: [{ messageId: "debuggerFound" }],
      },
    ],
  });
});
