import { testLintRule, type WorkspaceLintRule } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import plugin, {
  noDuplicatedBody,
  noLocalFiniteValueSet,
  noStrictCanonicalLiteralUse,
  noTwinDeclaration,
  noUnusedStyleClass,
} from "./plugin.ts";

const registeredArrayMutation = plugin.rules["no-array-mutation--derive-new-array"] as
  | WorkspaceLintRule
  | undefined;
if (registeredArrayMutation === undefined) {
  throw new Error("the array mutation rule must be registered");
}

testLintRule(registeredArrayMutation, {
  valid: [{ code: "const ordered = items.toSorted();" }],
  invalid: [
    {
      code: "const items: string[] = [];\nitems.sort();",
      errors: [{ messageId: "inPlaceArrayMutation" }],
    },
  ],
});

describe("dont-review-it plugin", () => {
  test("every registry key is the rule's public name", () => {
    const registeredNames = Object.entries(plugin.rules).map(([registeredName, rule]) => [
      registeredName,
      (rule as WorkspaceLintRule).name,
    ]);

    expect(plugin.meta).toStrictEqual({ name: "dont-review-it" });
    expect(registeredNames.every(([registeredName, ruleName]) => registeredName === ruleName)).toBe(
      true,
    );
  });

  test("rules built with repository loaders are the same instances exported by the package", () => {
    expect(plugin.rules[noDuplicatedBody.name]).toBe(noDuplicatedBody);
    expect(plugin.rules[noLocalFiniteValueSet.name]).toBe(noLocalFiniteValueSet);
    expect(plugin.rules[noStrictCanonicalLiteralUse.name]).toBe(noStrictCanonicalLiteralUse);
    expect(plugin.rules[noTwinDeclaration.name]).toBe(noTwinDeclaration);
    expect(plugin.rules[noUnusedStyleClass.name]).toBe(noUnusedStyleClass);
  });
});
