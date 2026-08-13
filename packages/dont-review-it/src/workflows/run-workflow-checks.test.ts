import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { runWorkflowChecks } from "./run-workflow-checks.ts";

describe("runWorkflowChecks", () => {
  describe("a definition that keeps every discipline", () => {
    const it = test.extend("scan", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-run-workflow-checks-"));
      const directory = join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "ci.yml"),
        `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    runs-on: ubuntu-latest
    steps:
      - run: vp run guard
`,
      );

      return runWorkflowChecks({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("says nothing about it and counts the one definition it read", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("one definition that breaks several disciplines", () => {
    const it = test.extend("linesOfTheProblems", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-run-workflow-checks-"));
      const directory = join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "ci.yml"),
        "on:\n  pull_request:\n    paths: [src/**]\njobs:\n  build:\n    steps:\n      - run: npm test || true\n",
      );

      return runWorkflowChecks({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      }).problems.map((problem) => problem.line);
    });

    it("reports them in the order they were written", ({ linesOfTheProblems }) => {
      expect(linesOfTheProblems).toStrictEqual([3, 5, 7, 7]);
    });
  });

  describe("a definition whose syntax is broken", () => {
    const it = test.extend("messagesOfTheProblems", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-run-workflow-checks-"));
      const directory = join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "ci.yml"), "jobs:\n build:\n   x: 1\n  y: 2\n");

      return runWorkflowChecks({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      }).problems.map((problem) => problem.message);
    });

    it("reports only that the definition cannot be read", ({ messagesOfTheProblems }) => {
      expect(messagesOfTheProblems).toStrictEqual([
        "A workflow definition that does not parse must not stay in the repository, because every check below reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.",
      ]);
    });
  });

  describe("several definitions that each break a discipline", () => {
    const it = test.extend("filesOfTheProblems", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-run-workflow-checks-"));
      const directory = join(repositoryRoot, defaultWorkflowChecksConfig.workflowDirectory);
      mkdirSync(directory, { recursive: true });
      writeFileSync(join(directory, "ci.yml"), "jobs:\n  build:\n    steps: []\n");
      writeFileSync(join(directory, "release.yml"), "jobs:\n  publish:\n    steps: []\n");

      return runWorkflowChecks({
        repositoryRoot,
        config: defaultWorkflowChecksConfig,
      }).problems.map((problem) => problem.file);
    });

    it("orders the problems by the file they were found in", ({ filesOfTheProblems }) => {
      expect(filesOfTheProblems).toStrictEqual([
        ".github/workflows/ci.yml",
        ".github/workflows/release.yml",
      ]);
    });
  });
});
