import { describe, expect, test } from "vite-plus/test";

import { LINT_SEVERITY } from "./lint-rule-severity.ts";

describe("lint-rule-severity", () => {
  test("every severity a lint rules map accepts is reachable through a named accessor", () => {
    expect(LINT_SEVERITY).toStrictEqual({ ERROR: "error", WARN: "warn", OFF: "off" });
  });
});
