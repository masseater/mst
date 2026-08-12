import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { UPSTREAM_PLUGINS, UPSTREAM_RULES, UPSTREAM_TEST_RULES } from "./upstream-rules.ts";

const PONYTAIL_UPSTREAM_RULE_NAMES = [
  "no-useless-call",
  "no-useless-return",
  "prefer-object-has-own",
  "typescript/prefer-readonly",
  "unicorn/no-useless-collection-argument",
  "unicorn/prefer-array-flat-map",
  "unicorn/prefer-blob-reading-methods",
  "unicorn/prefer-classlist-toggle",
  "unicorn/prefer-code-point",
  "unicorn/prefer-date-now",
  "unicorn/prefer-dom-node-append",
  "unicorn/prefer-dom-node-remove",
  "unicorn/prefer-import-meta-properties",
  "unicorn/prefer-math-min-max",
  "unicorn/prefer-math-trunc",
  "unicorn/prefer-modern-dom-apis",
  "unicorn/prefer-modern-math-apis",
  "unicorn/prefer-negative-index",
  "unicorn/prefer-number-coercion",
  "unicorn/prefer-query-selector",
  "unicorn/prefer-regexp-test",
  "unicorn/prefer-response-static-json",
  "unicorn/prefer-string-raw",
  "unicorn/prefer-string-replace-all",
  "unicorn/prefer-structured-clone",
] as const;

describe("upstream rule policy", () => {
  test("it enables every upstream plugin the configured rule prefixes require", () => {
    expect(UPSTREAM_PLUGINS).toStrictEqual([
      "import",
      "jsx-a11y",
      "oxc",
      "promise",
      "typescript",
      "unicorn",
      "vitest",
    ]);
  });

  test("all 25 upstream Ponytail rules are fixed at error severity", () => {
    const configuredRules = Object.fromEntries(
      PONYTAIL_UPSTREAM_RULE_NAMES.map((ruleName) => [ruleName, UPSTREAM_RULES[ruleName]]),
    );

    expect(PONYTAIL_UPSTREAM_RULE_NAMES).toHaveLength(25);
    expect(new Set(PONYTAIL_UPSTREAM_RULE_NAMES)).toHaveLength(25);
    expect(configuredRules).toStrictEqual(
      Object.fromEntries(
        PONYTAIL_UPSTREAM_RULE_NAMES.map((ruleName) => [ruleName, LINT_SEVERITY.ERROR]),
      ),
    );
  });

  test("production rules keep deliberate exceptions and option contracts explicit", () => {
    expect(UPSTREAM_RULES["no-unused-vars"]).toBe(LINT_SEVERITY.OFF);
    expect(UPSTREAM_RULES["class-methods-use-this"]).toBeUndefined();
    expect(UPSTREAM_RULES["func-style"]).toStrictEqual([
      LINT_SEVERITY.ERROR,
      "expression",
      { allowArrowFunctions: true },
    ]);
    expect(UPSTREAM_RULES["typescript/consistent-type-definitions"]).toStrictEqual([
      LINT_SEVERITY.ERROR,
      "type",
    ]);
    expect(UPSTREAM_RULES["typescript/switch-exhaustiveness-check"]).toStrictEqual([
      LINT_SEVERITY.ERROR,
      { considerDefaultExhaustiveForUnions: true },
    ]);
    expect(UPSTREAM_RULES["unicorn/prefer-string-replace-all"]).toBe(LINT_SEVERITY.ERROR);
    expect(UPSTREAM_RULES["prefer-object-has-own"]).toBe(LINT_SEVERITY.ERROR);
    expect(UPSTREAM_RULES["unicorn/prefer-prototype-methods"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-array-some"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-array-index-of"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-regexp-test"]).toBe(LINT_SEVERITY.ERROR);
    expect(UPSTREAM_RULES["typescript/prefer-regexp-exec"]).toBeUndefined();
    expect(UPSTREAM_RULES["no-useless-assignment"]).toBeUndefined();
    expect(UPSTREAM_RULES["no-useless-constructor"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/no-unnecessary-array-flat-depth"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-array-flat"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/no-unnecessary-array-splice-count"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/no-unnecessary-slice-end"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-add-event-listener"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-default-parameters"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-dom-node-dataset"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-dom-node-text-content"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-object-from-entries"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/no-new-buffer"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/no-useless-iterator-to-array"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-at"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-bigint-literals"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-class-fields"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-keyboard-event-key"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-node-protocol"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-native-coercion-functions"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-optional-catch-binding"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-string-slice"]).toBeUndefined();
    expect(UPSTREAM_RULES["unicorn/prefer-string-trim-start-end"]).toBeUndefined();
  });

  test("rules relax incompatible base checks while enforcing Vitest structure", () => {
    const disabledRuleNames = Object.entries(UPSTREAM_TEST_RULES)
      .filter(([, severity]) => severity === LINT_SEVERITY.OFF)
      .map(([ruleName]) => ruleName)
      .toSorted();

    expect(disabledRuleNames).toStrictEqual([
      "no-empty-pattern",
      "typescript/require-await",
      "typescript/unbound-method",
    ]);
    expect(UPSTREAM_TEST_RULES["vitest/max-nested-describe"]).toStrictEqual([
      LINT_SEVERITY.ERROR,
      { max: 2 },
    ]);
    expect(UPSTREAM_TEST_RULES["vitest/no-hooks"]).toBe(LINT_SEVERITY.ERROR);
    expect(UPSTREAM_TEST_RULES["vitest/warn-todo"]).toBe(LINT_SEVERITY.WARN);
  });
});
