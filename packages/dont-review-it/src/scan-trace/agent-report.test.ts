import { describe, expect, test } from "vite-plus/test";

import { agentScanTrace } from "./agent-report.ts";

describe("agentScanTrace", () => {
  describe("a check that opened its subjects", () => {
    const it = test.extend("trace", () =>
      agentScanTrace([
        {
          check: "workflow-definitions",
          unit: "definition",
          count: 2,
          skippedReason: null,
          problems: [],
          warnings: [],
        },
      ]));

    it("reports the scale it read and what it found", ({ trace }) => {
      expect(trace).toBe("checked workflow-definitions 2 definitions 0 problems 0 warnings\n");
    });
  });

  describe("a check that found violations", () => {
    const it = test.extend("trace", () =>
      agentScanTrace([
        {
          check: "workflow-definitions",
          unit: "definition",
          count: 2,
          skippedReason: null,
          problems: ["a", "b"],
          warnings: ["c"],
        },
      ]));

    it("carries their number on the same line", ({ trace }) => {
      expect(trace).toBe("checked workflow-definitions 2 definitions 2 problems 1 warning\n");
    });
  });

  describe("a check that never opened a subject", () => {
    const it = test.extend("trace", () =>
      agentScanTrace([
        {
          check: "dependency-declarations",
          unit: "definition",
          count: 0,
          skippedReason: "no workspace definition",
          problems: [],
          warnings: [],
        },
      ]));

    it("is named as skipped with its reason", ({ trace }) => {
      expect(trace).toBe("skipped dependency-declarations no workspace definition\n");
    });
  });

  describe("a run of no checks", () => {
    const it = test.extend("trace", () => agentScanTrace([]));

    it("writes nothing", ({ trace }) => {
      expect(trace).toBe("");
    });
  });
});
