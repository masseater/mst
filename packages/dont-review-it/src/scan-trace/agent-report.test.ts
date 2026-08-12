import { describe, expect, test } from "vite-plus/test";

import { agentScanTrace } from "./agent-report.ts";

import type { CheckOutcome } from "@mst/repository-checks";

const outcomeWith = (overrides: Partial<CheckOutcome>): CheckOutcome => ({
  check: "workflow-definitions",
  unit: "definition",
  count: 2,
  skippedReason: null,
  problems: [],
  warnings: [],
  ...overrides,
});

describe("agentScanTrace", () => {
  test("a check that opened its subjects reports the scale it read and what it found", () => {
    expect(agentScanTrace([outcomeWith({})])).toBe(
      "checked workflow-definitions 2 definitions 0 problems 0 warnings\n",
    );
  });

  test("a check that found violations carries their number on the same line", () => {
    expect(agentScanTrace([outcomeWith({ problems: ["a", "b"], warnings: ["c"] })])).toBe(
      "checked workflow-definitions 2 definitions 2 problems 1 warning\n",
    );
  });

  test("a check that never opened a subject is named as skipped with its reason", () => {
    expect(
      agentScanTrace([
        outcomeWith({
          check: "dependency-declarations",
          count: 0,
          skippedReason: "no workspace definition",
        }),
      ]),
    ).toBe("skipped dependency-declarations no workspace definition\n");
  });

  test("a run of no checks writes nothing", () => {
    expect(agentScanTrace([])).toBe("");
  });
});
