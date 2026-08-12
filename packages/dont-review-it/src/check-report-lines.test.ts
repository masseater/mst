import { describe, expect, test } from "vite-plus/test";

import { checkReportLines } from "./check-report-lines.ts";

describe("check-report-lines", () => {
  test("warning reports keep their label beside problem reports", () => {
    expect(checkReportLines({ problems: ["problem"], warnings: ["warning"] })).toStrictEqual([
      "problem",
      "warning: warning",
    ]);
  });
});
