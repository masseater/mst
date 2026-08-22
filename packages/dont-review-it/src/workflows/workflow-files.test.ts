import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { readWorkflowDocuments } from "./workflow-files.ts";

describe("readWorkflowDocuments", () => {
  describe("a repository that has no workflow directory", () => {
    const it = test.extend("documents", () =>
      readWorkflowDocuments({
        repositoryRoot: join(
          mkdtempSync(join(tmpdir(), "dont-review-it-workflow-files-")),
          "absent",
        ),
        config: defaultWorkflowChecksConfig,
      }));

    it("reads nothing at all", ({ documents }) => {
      expect(documents).toStrictEqual([]);
    });
  });

  describe("a directory holding both spellings of the extension beside a file that is no workflow", () => {
    const it = test.extend("pathsOfTheDocuments", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-workflow-files-"));
      const directory = join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "release.yaml"), "name: Release\n");
      writeFileSync(join(directory, "ci.yml"), "name: CI\n");
      writeFileSync(join(directory, "README.md"), "# not a workflow\n");

      return readWorkflowDocuments({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      }).map((document) => document.relativePath);
    });

    it("reads both definitions and leaves the other file alone", ({ pathsOfTheDocuments }) => {
      expect(pathsOfTheDocuments).toStrictEqual([
        ".github/workflows/ci.yml",
        ".github/workflows/release.yaml",
      ]);
    });
  });
});
