import { describe, expect, test } from "vite-plus/test";

import { humanScanTrace } from "./human-report.ts";

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

const plainTrace = (outcomes: readonly CheckOutcome[]): string =>
  humanScanTrace({ outcomes, colored: false });

describe("humanScanTrace", () => {
  test("a run of no checks writes nothing", () => {
    expect(plainTrace([])).toBe("");
  });

  test("a check that opened its subjects and found nothing is marked as passed", () => {
    expect(plainTrace([outcomeWith({})])).toBe(
      "  ✓ workflow-definitions  2 definitions\n\n  1 check ran, nothing to report\n",
    );
  });

  test("a check that found violations is marked as failed and carries their number", () => {
    expect(plainTrace([outcomeWith({ problems: ["a", "b"] })])).toBe(
      "  ✗ workflow-definitions  2 definitions  2 problems\n\n  1 check ran, 2 problems\n",
    );
  });

  test("a check that never opened a subject is marked as skipped and states its reason", () => {
    expect(
      plainTrace([
        outcomeWith({
          check: "dependency-declarations",
          count: 0,
          skippedReason: "no workspace definition",
        }),
      ]),
    ).toBe(
      "  ⊘ dependency-declarations  skipped — no workspace definition\n\n  1 check ran, nothing to report\n",
    );
  });

  test("the names and the numbers of several checks are aligned into columns", () => {
    expect(
      plainTrace([
        outcomeWith({ check: "intent-skills", unit: "manifest", count: 128 }),
        outcomeWith({}),
      ]),
    ).toBe(
      "  ✓ intent-skills         128 manifests\n  ✓ workflow-definitions    2 definitions\n\n  2 checks ran, nothing to report\n",
    );
  });

  test("a warning leaves the check standing as passed and is named as a warning", () => {
    expect(plainTrace([outcomeWith({ warnings: ["a"] })])).toBe(
      "  ✓ workflow-definitions  2 definitions  1 warning\n\n  1 check ran, 1 warning\n",
    );
  });

  test("problems and warnings are named side by side when both are present", () => {
    expect(plainTrace([outcomeWith({ problems: ["a"], warnings: ["b"] })])).toBe(
      "  ✗ workflow-definitions  2 definitions  1 problem, 1 warning\n\n  1 check ran, 1 problem, 1 warning\n",
    );
  });

  test("a reader that can take colour is handed the marks wrapped in it", () => {
    expect(humanScanTrace({ outcomes: [outcomeWith({})], colored: true })).toContain("[32m✓");
  });
});
