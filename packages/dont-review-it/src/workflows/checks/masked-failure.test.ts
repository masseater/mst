import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { maskedFailures } from "./masked-failure.ts";

const SWALLOWED_BY_AN_EXIT = `A failure must not be swallowed inside a run block, and || exit 0 swallows one. Delete it, and let the exit status of the command stand. If the command fails for a reason this run should tolerate, fix that in the command instead of here.`;

const SWALLOWED_BY_A_TRUE = `A failure must not be swallowed inside a run block, and || true swallows one. Delete it, and let the exit status of the command stand. If the command fails for a reason this run should tolerate, fix that in the command instead of here.`;

const TURNED_INTO_A_PASS = `A failure must not be reported as a pass, and continue-on-error turns one into the other. Delete it, and let the failure stop the run. If the step is genuinely optional, move it out of the run that a gate counts.`;

describe("maskedFailures", () => {
  describe("an operator written across lines", () => {
    const it = test.extend("problems", () =>
      maskedFailures({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source:
            "jobs:\n  build:\n    steps:\n      - run: |\n          npm test ||\n            exit 0\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is found through the spacing it was written with", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 4, message: SWALLOWED_BY_AN_EXIT },
      ]);
    });
  });

  describe("a job that is allowed to fail", () => {
    const it = test.extend("problems", () =>
      maskedFailures({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    continue-on-error: true\n    steps: []\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 3, message: TURNED_INTO_A_PASS },
      ]);
    });
  });

  describe("a step that is allowed to fail", () => {
    const it = test.extend("problems", () =>
      maskedFailures({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - continue-on-error: true\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 4, message: TURNED_INTO_A_PASS },
      ]);
    });
  });

  describe("a job that declares it must not fail", () => {
    const it = test.extend("problems", () =>
      maskedFailures({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    continue-on-error: false\n    steps: []\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a script that swallows the status of its command", () => {
    const it = test.extend("problems", () =>
      maskedFailures({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run: npm test || true\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 4, message: SWALLOWED_BY_A_TRUE },
      ]);
    });
  });

  describe("a script that lets the status of its command stand", () => {
    const it = test.extend("problems", () =>
      maskedFailures({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run: npm test\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a step that declares no script", () => {
    const it = test.extend("problems", () =>
      maskedFailures({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "jobs:\n  build:\n    steps:\n      - run:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
