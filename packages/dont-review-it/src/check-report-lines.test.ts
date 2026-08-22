import { describe, expect, test } from "vite-plus/test";

import { checkReportLines } from "./check-report-lines.ts";

describe("check-report-lines", () => {
  const it = test.extend("reportedLines", () =>
    checkReportLines({ problems: ["problem"], warnings: ["warning"] }));

  it("warning reports keep their label beside problem reports", ({ reportedLines }) => {
    expect(reportedLines).toStrictEqual(["problem", "warning: warning"]);
  });
});
