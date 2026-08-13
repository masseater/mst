import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { gatingTriggerFilters } from "./gating-trigger-filter.ts";

const PATHS_UNDER_PULL_REQUEST = `A workflow that branch protection can require must not narrow its own start with paths under pull_request, because a run that never starts has no result to distinguish from a passing one. Drop paths from the trigger, and express the narrowing in the if of a job or a step so the run still reports.`;

const BRANCHES_UNDER_PULL_REQUEST_TARGET = `A workflow that branch protection can require must not narrow its own start with branches under pull_request_target, because a run that never starts has no result to distinguish from a passing one. Drop branches from the trigger, and express the narrowing in the if of a job or a step so the run still reports.`;

describe("gatingTriggerFilters", () => {
  describe("a path filter placed on the trigger a gate is required from", () => {
    const it = test.extend("problems", () =>
      gatingTriggerFilters({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  pull_request:\n    paths:\n      - src/**\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported beside the line the filter was written on", ({ problems }) => {
      expect(problems).toStrictEqual([
        { file: ".github/workflows/ci.yml", line: 3, message: PATHS_UNDER_PULL_REQUEST },
      ]);
    });
  });

  describe("a branch filter on the trigger that runs against a fork target", () => {
    const it = test.extend("problems", () =>
      gatingTriggerFilters({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  pull_request_target:\n    branches: [main]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is reported once", ({ problems }) => {
      expect(problems).toStrictEqual([
        {
          file: ".github/workflows/ci.yml",
          line: 3,
          message: BRANCHES_UNDER_PULL_REQUEST_TARGET,
        },
      ]);
    });
  });

  describe("a trigger that starts on every change", () => {
    const it = test.extend("problems", () =>
      gatingTriggerFilters({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  pull_request:\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a key that does not narrow which runs start", () => {
    const it = test.extend("problems", () =>
      gatingTriggerFilters({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  pull_request:\n    types: [opened]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("a filter on a trigger that a gate is not required from", () => {
    const it = test.extend("problems", () =>
      gatingTriggerFilters({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  push:\n    branches: [main]\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });

  describe("an entry whose key is not a plain value", () => {
    const it = test.extend("problems", () =>
      gatingTriggerFilters({
        document: parseWorkflowDocument({
          relativePath: ".github/workflows/ci.yml",
          source: "on:\n  pull_request:\n    ? [paths]\n    : value\n",
        }),
        config: defaultWorkflowChecksConfig,
      }));

    it("is left alone", ({ problems }) => {
      expect(problems).toStrictEqual([]);
    });
  });
});
