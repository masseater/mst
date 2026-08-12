import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { workflowOutcomesOf } from "./workflow-outcomes.ts";

const config = defaultWorkflowChecksConfig;

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-workflow-outcomes-"));

const outcomesFor = (fixtureName: string, files: Readonly<Record<string, string>>) => {
  const repositoryRoot = join(fixtureDir, fixtureName);
  mkdirSync(repositoryRoot, { recursive: true });
  Object.entries(files).forEach(([relativePath, source]) => {
    const workflowPath = join(repositoryRoot, relativePath);
    mkdirSync(dirname(workflowPath), { recursive: true });
    writeFileSync(workflowPath, source);
  });
  return workflowOutcomesOf({ repositoryRoot, config });
};

const WORKFLOW_PATH = ".github/workflows/ci.yml";

const GATED_WORKFLOW = `on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`;

describe("workflowOutcomesOf", () => {
  it("counts the definitions it read", () => {
    expect(
      outcomesFor("counted", { "renovate.json": "{}\n", [WORKFLOW_PATH]: GATED_WORKFLOW })
        .definitions.scanned,
    ).toBe(1);
  });

  it("looks for the update mechanism once a definition exists", () => {
    expect(
      outcomesFor("without-mechanism", { [WORKFLOW_PATH]: GATED_WORKFLOW }).updates.problems.length,
    ).toBe(1);
  });

  it("leaves the update mechanism unasked for when no definition exists", () => {
    expect(
      outcomesFor("no-definition", { "package.json": `{"name": "solo"}` }).updates,
    ).toStrictEqual({
      problems: [],
      scanned: 0,
    });
  });
});
