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
  describe("a reader that is an agent", () => {
    const it = test.extend("trace", () =>
      scanTraceFor({ outcomes: OUTCOMES, readByAgent: true, colored: false }));

    it("is handed the flat form", ({ trace }) => {
      expect(trace).toBe("checked workflow-definitions 2 definitions 0 problems 0 warnings\n");
    });
  });

  describe("a reader that is a person", () => {
    const it = test.extend("trace", () =>
      scanTraceFor({ outcomes: OUTCOMES, readByAgent: false, colored: false }));

    it("is handed the marked and aligned form", ({ trace }) => {
      expect(trace).toBe(
        "  ✓ workflow-definitions  2 definitions\n\n  1 check ran, nothing to report\n",
      );
    });
  });
});
