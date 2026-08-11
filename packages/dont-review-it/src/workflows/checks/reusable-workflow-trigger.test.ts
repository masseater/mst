import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { reusableWorkflowTriggers } from "./reusable-workflow-trigger.ts";

const config = defaultWorkflowChecksConfig;

const problemsFor = (source: string) =>
  reusableWorkflowTriggers({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

describe("reusableWorkflowTriggers", () => {
  it("reports a callable part that also starts itself", () => {
    expect(problemsFor("on:\n  workflow_call:\n  push:\n")[0]?.message).toContain("push");
  });

  it("leaves a part that only ever starts from its caller alone", () => {
    expect(problemsFor("on:\n  workflow_call:\n")).toStrictEqual([]);
  });

  it("leaves a workflow that is not callable alone", () => {
    expect(problemsFor("on:\n  push:\n")).toStrictEqual([]);
  });

  it("reads the triggers written as a list", () => {
    expect(problemsFor("on: [workflow_call, push]\n")[0]?.message).toContain("push");
  });

  it("names the line the triggers were written on when they are a list", () => {
    expect(problemsFor("name: Part\non: [workflow_call, push]\n")[0]?.line).toBe(2);
  });

  it("leaves a list that only makes the workflow callable alone", () => {
    expect(problemsFor("on: [workflow_call]\n")).toStrictEqual([]);
  });

  it("leaves a single trigger written on its own alone", () => {
    expect(problemsFor("on: push\n")).toStrictEqual([]);
  });
});
