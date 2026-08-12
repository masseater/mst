import { describe, expect, test } from "vite-plus/test";

import { scanTraceFor } from "./scan-trace-report.ts";

import type { CheckOutcome } from "@mst/repository-checks";

const OUTCOMES: readonly CheckOutcome[] = [
  {
    check: "workflow-definitions",
    unit: "definition",
    count: 2,
    skippedReason: null,
    problems: [],
    warnings: [],
  },
];

describe("scanTraceFor", () => {
  test("a reader that is an agent is handed the flat form", () => {
    expect(scanTraceFor({ outcomes: OUTCOMES, readByAgent: true, colored: false })).toBe(
      "checked workflow-definitions 2 definitions 0 problems 0 warnings\n",
    );
  });

  test("a reader that is a person is handed the marked and aligned form", () => {
    expect(scanTraceFor({ outcomes: OUTCOMES, readByAgent: false, colored: false })).toBe(
      "  ✓ workflow-definitions  2 definitions\n\n  1 check ran, nothing to report\n",
    );
  });
});
