import { expect, test } from "vite-plus/test";

import { LINT_RULE_SEVERITIES, LINT_SEVERITY } from "./lint-rule-severity.ts";

test("the vocabulary lists every severity a lint rules map accepts", () => {
  expect(LINT_RULE_SEVERITIES).toStrictEqual(["error", "warn", "off"]);
});

test("every listed severity is reachable through a named accessor", () => {
  expect(LINT_SEVERITY).toStrictEqual({ ERROR: "error", WARN: "warn", OFF: "off" });
});
