import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { workflowOutcomesOf } from "./workflow-outcomes.ts";

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
  describe("a repository holding a workflow definition beside a renovate configuration", () => {
    const it = test.extend("outcomesOfGatedRepositoryOnRenovate", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-workflow-outcomes-"));
      const workflowFile = join(repositoryRoot, WORKFLOW_PATH);
      mkdirSync(dirname(workflowFile), { recursive: true });
      writeFileSync(workflowFile, GATED_WORKFLOW);
      writeFileSync(join(repositoryRoot, "renovate.json"), "{}\n");
      return workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("counts the definition it read", ({ outcomesOfGatedRepositoryOnRenovate }) => {
      expect(outcomesOfGatedRepositoryOnRenovate).toStrictEqual({
        definitions: { problems: [], scanned: 1 },
        updates: { problems: [], scanned: 1 },
      });
    });
  });

  describe("a repository holding a workflow definition with no update mechanism", () => {
    const it = test.extend("outcomesOfGatedRepositoryWithoutMechanism", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-workflow-outcomes-"));
      const workflowFile = join(repositoryRoot, WORKFLOW_PATH);
      mkdirSync(dirname(workflowFile), { recursive: true });
      writeFileSync(workflowFile, GATED_WORKFLOW);
      return workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("looks for the update mechanism once a definition exists", ({
      outcomesOfGatedRepositoryWithoutMechanism,
    }) => {
      expect(outcomesOfGatedRepositoryWithoutMechanism).toStrictEqual({
        definitions: { problems: [], scanned: 1 },
        updates: {
          problems: [
            {
              file: ".github/workflows",
              line: null,
              message:
                "A repository that pins its action references must not leave the pins without something that raises them, because a pin holds an action at the version it had on the day it was written and nothing afterwards notices that the version aged. Which pin is current cannot be settled by reading this repository, so what is required here is the mechanism rather than the answer. Add a Renovate configuration, or a Dependabot configuration whose `updates` cover the `github-actions` ecosystem, so every pinned commit SHA is raised in a pull request that a person reviews.",
            },
          ],
          scanned: 0,
        },
      });
    });
  });

  describe("a repository holding no workflow definition", () => {
    const it = test.extend("outcomesOfRepositoryWithoutDefinition", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-workflow-outcomes-"));
      writeFileSync(join(repositoryRoot, "package.json"), `{"scenario": "solo"}`);
      return workflowOutcomesOf({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("leaves the update mechanism unasked for when no definition exists", ({
      outcomesOfRepositoryWithoutDefinition,
    }) => {
      expect(outcomesOfRepositoryWithoutDefinition).toStrictEqual({
        definitions: { problems: [], scanned: 0 },
        updates: { problems: [], scanned: 0 },
      });
    });
  });
});
