import { describe, expect, test } from "vite-plus/test";

import { type WorkspaceLintRule } from "./create-workspace-lint-rule.ts";
import { forbidSymbolPrefixedName } from "./lint/oxlint/rules/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts";
import { noBroadLintDisable } from "./lint/oxlint/rules/no-broad-lint-disable--use-next-line-with-reason.ts";
import { noExplainedLintMessage } from "./lint/oxlint/rules/no-explained-lint-message--state-prohibition-then-fix.ts";
import plugin from "./plugin.ts";
import { testLintRule } from "./rule-tester.ts";

const registeredBroadDisable = plugin.rules["no-broad-lint-disable--use-next-line-with-reason"] as
  | WorkspaceLintRule
  | undefined;
if (registeredBroadDisable === undefined) {
  throw new Error("the broad lint disable rule must be registered");
}

testLintRule(registeredBroadDisable, {
  valid: [
    {
      code: "// oxlint-disable-next-line no-console -- the CLI writes its result here\nconsole.log(1);",
    },
  ],
  invalid: [
    {
      code: "// oxlint-disable\nconsole.log(1);",
      errors: [{ messageId: "broadLintDisable" }],
    },
  ],
});

describe("lint-rule-authoring plugin", () => {
  const it = test.extend("lintRuleAuthoringPlugin", () => plugin);

  it("publishes its complete package registry", ({ lintRuleAuthoringPlugin }) => {
    expect(lintRuleAuthoringPlugin).toStrictEqual({
      meta: { name: "lint-rule-authoring" },
      rules: {
        "forbid-symbol-prefixed-name--rename-to-alphanumeric-start": forbidSymbolPrefixedName,
        "no-broad-lint-disable--use-next-line-with-reason": noBroadLintDisable,
        "no-explained-lint-message--state-prohibition-then-fix": noExplainedLintMessage,
      },
    });
  });
});
