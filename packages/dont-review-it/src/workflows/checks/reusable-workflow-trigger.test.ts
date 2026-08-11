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
});
