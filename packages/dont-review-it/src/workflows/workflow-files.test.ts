import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { readWorkflowDocuments } from "./workflow-files.ts";

const config = defaultWorkflowChecksConfig;

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-workflow-files-"));

const repositoryWith = (name: string, files: Readonly<Record<string, string>>): string => {
  const repositoryRoot = join(fixtureDir, name);
  const directory = join(repositoryRoot, config.workflowDirectory);
  mkdirSync(directory, { recursive: true });
  Object.entries(files).forEach(([fileName, source]) => {
    writeFileSync(join(directory, fileName), source);
  });
  return repositoryRoot;
};

describe("readWorkflowDocuments", () => {
  it("reads nothing from a repository that has no workflow directory", () => {
    expect(
      readWorkflowDocuments({ repositoryRoot: join(fixtureDir, "absent"), config }),
    ).toStrictEqual([]);
  });

  it("reads both spellings of the extension and leaves other files alone", () => {
    const repositoryRoot = repositoryWith("mixed", {
      "release.yaml": "name: Release\n",
      "ci.yml": "name: CI\n",
      "README.md": "# not a workflow\n",
    });

    expect(
      readWorkflowDocuments({ repositoryRoot, config }).map((document) => document.relativePath),
    ).toStrictEqual([".github/workflows/ci.yml", ".github/workflows/release.yaml"]);
  });
});
