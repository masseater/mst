import { describe, expect, test } from "vite-plus/test";

import { type WorkspaceLintRule } from "./create-workspace-lint-rule.ts";
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
  test("it publishes the expected registry under its package name", () => {
    expect(plugin.meta).toStrictEqual({ name: "lint-rule-authoring" });
    expect(Object.keys(plugin.rules).toSorted()).toStrictEqual([
      "forbid-symbol-prefixed-name--rename-to-alphanumeric-start",
      "no-broad-lint-disable--use-next-line-with-reason",
      "no-explained-lint-message--state-prohibition-then-fix",
    ]);
  });

  test("every registry key is the registered rule's public name", () => {
    const registrations = Object.entries(plugin.rules).map(([registeredName, rule]) => [
      registeredName,
      (rule as WorkspaceLintRule).name,
    ]);

    expect(registrations.every(([registeredName, ruleName]) => registeredName === ruleName)).toBe(
      true,
    );
  });
});
