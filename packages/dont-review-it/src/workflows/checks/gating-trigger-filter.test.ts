import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { gatingTriggerFilters } from "./gating-trigger-filter.ts";

const config = defaultWorkflowChecksConfig;

const problemsFor = (source: string) =>
  gatingTriggerFilters({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

describe("gatingTriggerFilters", () => {
  it("reports a path filter placed on the trigger a gate is required from", () => {
    expect(problemsFor("on:\n  pull_request:\n    paths:\n      - src/**\n")[0]?.line).toBe(3);
  });

  it("reports a branch filter on the trigger that runs against a fork target", () => {
    expect(problemsFor("on:\n  pull_request_target:\n    branches: [main]\n").length).toBe(1);
  });

  it("leaves a trigger that starts on every change alone", () => {
    expect(problemsFor("on:\n  pull_request:\n")).toStrictEqual([]);
  });

  it("leaves the keys that do not narrow which runs start alone", () => {
    expect(problemsFor("on:\n  pull_request:\n    types: [opened]\n")).toStrictEqual([]);
  });

  it("leaves a filter on a trigger that a gate is not required from alone", () => {
    expect(problemsFor("on:\n  push:\n    branches: [main]\n")).toStrictEqual([]);
  });

  it("leaves an entry whose key is not a plain value alone", () => {
    expect(problemsFor("on:\n  pull_request:\n    ? [paths]\n    : value\n")).toStrictEqual([]);
  });
});
