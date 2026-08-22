import { describe, expect, it } from "vite-plus/test";

import { LINT_SEVERITY } from "../src/index.ts";

describe("lint ルールの重大度の語彙", () => {
  it("error と warn と off の 3 値だけを公開する", () => {
    expect(LINT_SEVERITY).toStrictEqual({ ERROR: "error", WARN: "warn", OFF: "off" });
  });

  it("公開した重大度の名前と値を呼び手がすり替えられない", () => {
    expect(Object.isFrozen(LINT_SEVERITY)).toBe(true);
  });
});
