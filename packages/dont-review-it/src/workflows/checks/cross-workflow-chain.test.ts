import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "../config.ts";
import { parseWorkflowDocument } from "../workflow-document.ts";
import { crossWorkflowChains } from "./cross-workflow-chain.ts";

const config = defaultWorkflowChecksConfig;

const problemsFor = (source: string) =>
  crossWorkflowChains({
    document: parseWorkflowDocument({ relativePath: ".github/workflows/ci.yml", source }),
    config,
  });

describe("crossWorkflowChains", () => {
  it("reports a workflow that starts from the result of another one", () => {
    expect(problemsFor("on:\n  workflow_run:\n    workflows: [CI]\n")[0]?.line).toBe(2);
  });

  it("leaves a workflow that starts from a change alone", () => {
    expect(problemsFor("on:\n  push:\n")).toStrictEqual([]);
  });
});
