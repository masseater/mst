import { describe, expect, test } from "vite-plus/test";

import { humanScanTrace } from "./human-report.ts";

describe("humanScanTrace", () => {
  describe("a run of no checks", () => {
    const it = test.extend("trace", () => humanScanTrace({ outcomes: [], colored: false }));

    it("writes nothing", ({ trace }) => {
      expect(trace).toBe("");
    });
  });

  describe("a check that opened its subjects and found nothing", () => {
    const it = test.extend("trace", () =>
      humanScanTrace({
        outcomes: [
          {
            check: "workflow-definitions",
            unit: "definition",
            count: 2,
            skippedReason: null,
            problems: [],
            warnings: [],
          },
        ],
        colored: false,
      }));

    it("is marked as passed above a tally that reports nothing", ({ trace }) => {
      expect(trace).toBe(
        "  ✓ workflow-definitions  2 definitions\n\n  1 check ran, nothing to report\n",
      );
    });
  });

  describe("a check that found violations", () => {
    const it = test.extend("trace", () =>
      humanScanTrace({
        outcomes: [
          {
            check: "workflow-definitions",
            unit: "definition",
            count: 2,
            skippedReason: null,
            problems: ["a", "b"],
            warnings: [],
          },
        ],
        colored: false,
      }));

    it("is marked as failed and carries their number", ({ trace }) => {
      expect(trace).toBe(
        "  ✗ workflow-definitions  2 definitions  2 problems\n\n  1 check ran, 2 problems\n",
      );
    });
  });

  describe("a check that never opened a subject", () => {
    const it = test.extend("trace", () =>
      humanScanTrace({
        outcomes: [
          {
            check: "dependency-declarations",
            unit: "definition",
            count: 0,
            skippedReason: "no workspace definition",
            problems: [],
            warnings: [],
          },
        ],
        colored: false,
      }));

    it("is marked as skipped and states its reason", ({ trace }) => {
      expect(trace).toBe(
        "  ⊘ dependency-declarations  skipped — no workspace definition\n\n  1 check ran, nothing to report\n",
      );
    });
  });

  describe("several checks of differing name and count", () => {
    const it = test.extend("trace", () =>
      humanScanTrace({
        outcomes: [
          {
            check: "intent-skills",
            unit: "manifest",
            count: 128,
            skippedReason: null,
            problems: [],
            warnings: [],
          },
          {
            check: "workflow-definitions",
            unit: "definition",
            count: 2,
            skippedReason: null,
            problems: [],
            warnings: [],
          },
        ],
        colored: false,
      }));

    it("have their names and their numbers aligned into columns", ({ trace }) => {
      expect(trace).toBe(
        "  ✓ intent-skills         128 manifests\n  ✓ workflow-definitions    2 definitions\n\n  2 checks ran, nothing to report\n",
      );
    });
  });

  describe("a check that raised a warning and no problem", () => {
    const it = test.extend("trace", () =>
      humanScanTrace({
        outcomes: [
          {
            check: "workflow-definitions",
            unit: "definition",
            count: 2,
            skippedReason: null,
            problems: [],
            warnings: ["a"],
          },
        ],
        colored: false,
      }));

    it("stands as passed with the warning named", ({ trace }) => {
      expect(trace).toBe(
        "  ✓ workflow-definitions  2 definitions  1 warning\n\n  1 check ran, 1 warning\n",
      );
    });
  });

  describe("a check that raised both a problem and a warning", () => {
    const it = test.extend("trace", () =>
      humanScanTrace({
        outcomes: [
          {
            check: "workflow-definitions",
            unit: "definition",
            count: 2,
            skippedReason: null,
            problems: ["a"],
            warnings: ["b"],
          },
        ],
        colored: false,
      }));

    it("names them side by side", ({ trace }) => {
      expect(trace).toBe(
        "  ✗ workflow-definitions  2 definitions  1 problem, 1 warning\n\n  1 check ran, 1 problem, 1 warning\n",
      );
    });
  });

  describe("a reader that can take colour", () => {
    const it = test.extend("trace", () =>
      humanScanTrace({
        outcomes: [
          {
            check: "workflow-definitions",
            unit: "definition",
            count: 2,
            skippedReason: null,
            problems: [],
            warnings: [],
          },
        ],
        colored: true,
      }));

    it("is handed the mark and the tally wrapped in it", ({ trace }) => {
      expect(trace).toBe(
        "  \x1B[32m✓\x1B[39m workflow-definitions  2 definitions\n\n  \x1B[2m1 check ran, nothing to report\x1B[22m\n",
      );
    });
  });
});
