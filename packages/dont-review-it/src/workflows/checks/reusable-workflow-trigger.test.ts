import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { reusableWorkflowTriggers } from "./reusable-workflow-trigger.ts";

const OWNED_PUSH = `A part that other workflows call must not own a trigger of its own, because the permissions and the concurrency it declares then apply to runs no caller asked for. Drop push from this file, and leave the start to the workflow that calls it.`;

describe("reusableWorkflowTriggers", () => {
  describe("a callable part that also starts itself", () => {
    const it = test.extend("problems", () =>
      reusableWorkflowTriggers({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  workflow_call:\n  push:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported with the trigger it owns named in the message", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 2, message: OWNED_PUSH },
      ]);
    });
  });

  describe("a part that only ever starts from its caller", () => {
    const it = test.extend("problems", () =>
      reusableWorkflowTriggers({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  workflow_call:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a workflow that is not callable", () => {
    const it = test.extend("problems", () =>
      reusableWorkflowTriggers({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  push:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("the triggers written as a list", () => {
    const it = test.extend("problems", () =>
      reusableWorkflowTriggers({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: [workflow_call, push]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("are read, and the trigger the part owns is named in the message", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 1, message: OWNED_PUSH },
      ]);
    });
  });

  describe("the triggers written as a list below the name of the workflow", () => {
    const it = test.extend("problems", () =>
      reusableWorkflowTriggers({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "name: Part\non: [workflow_call, push]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("are reported beside the line they were written on", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 2, message: OWNED_PUSH },
      ]);
    });
  });

  describe("a list that only makes the workflow callable", () => {
    const it = test.extend("problems", () =>
      reusableWorkflowTriggers({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: [workflow_call]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a single trigger written on its own", () => {
    const it = test.extend("problems", () =>
      reusableWorkflowTriggers({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: push\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
