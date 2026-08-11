import { describe, expect, it } from "vite-plus/test";

import { LINT_SEVERITY } from "../src/index.ts";

describe("lint ルールの重大度の語彙", () => {
  it("error と warn と off の 3 値だけを公開する", () => {
    expect(LINT_SEVERITY).toStrictEqual({ ERROR: "error", WARN: "warn", OFF: "off" });
  });
});
