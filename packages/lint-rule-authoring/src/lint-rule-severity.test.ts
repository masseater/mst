import { describe, expect, it } from "vite-plus/test";

import { LINT_SEVERITY } from "./lint-rule-severity.ts";

describe("lint-rule-severity", () => {
  it("every severity a lint rules map accepts is reachable through a named accessor", () => {
    expect(LINT_SEVERITY).toStrictEqual({ ERROR: "error", WARN: "warn", OFF: "off" });
  });
});
