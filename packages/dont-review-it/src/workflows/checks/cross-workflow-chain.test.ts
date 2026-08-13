import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { crossWorkflowChains } from "./cross-workflow-chain.ts";

const SPLIT_ACROSS_RUNS = `Work that reads the result of other work must not be split across runs, and workflow_run splits it. Move these jobs into the workflow whose result they consume, and order them with needs so the whole chain succeeds or fails as one.`;

describe("crossWorkflowChains", () => {
  describe("a workflow started by the result of another one", () => {
    const it = test.extend("problems", () =>
      crossWorkflowChains({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  workflow_run:\n    workflows: [CI]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported beside the line the trigger was written on", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 2, message: SPLIT_ACROSS_RUNS },
      ]);
    });
  });

  describe("a workflow started by a change", () => {
    const it = test.extend("problems", () =>
      crossWorkflowChains({
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

  describe("the trigger written in a list", () => {
    const it = test.extend("problems", () =>
      crossWorkflowChains({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: [workflow_run]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is read and reported once", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 1, message: SPLIT_ACROSS_RUNS },
      ]);
    });
  });

  describe("the trigger written on its own", () => {
    const it = test.extend("problems", () =>
      crossWorkflowChains({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: workflow_run\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is read and reported once", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 1, message: SPLIT_ACROSS_RUNS },
      ]);
    });
  });

  describe("a list naming other triggers", () => {
    const it = test.extend("problems", () =>
      crossWorkflowChains({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on: [push, pull_request]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
