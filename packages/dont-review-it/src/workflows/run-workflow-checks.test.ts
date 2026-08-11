import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { defaultWorkflowChecksConfig } from "./config.ts";
import { runWorkflowChecks } from "./run-workflow-checks.ts";

const config = defaultWorkflowChecksConfig;

const fixtureDir = join(tmpdir(), "dont-review-it-run-workflow-checks");
rmSync(fixtureDir, { recursive: true, force: true });

const repositoryWith = (name: string, files: Readonly<Record<string, string>>): string => {
  const repositoryRoot = join(fixtureDir, name);
  const directory = join(repositoryRoot, config.workflowDirectory);
  mkdirSync(directory, { recursive: true });
  Object.entries(files).forEach(([fileName, source]) => {
    writeFileSync(join(directory, fileName), source);
  });
  return repositoryRoot;
};

const GATED = `name: CI
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
`;

describe("runWorkflowChecks", () => {
  it("says nothing about a definition that keeps every discipline", () => {
    expect(
      runWorkflowChecks({ repositoryRoot: repositoryWith("gated", { "ci.yml": GATED }), config }),
    ).toStrictEqual([]);
  });

  it("reports the problems of one definition in the order they were written", () => {
    const repositoryRoot = repositoryWith("broken", {
      "ci.yml": `on:
  pull_request:
    paths: [src/**]
jobs:
  build:
    steps:
      - run: npm test || true
`,
    });

    expect(
      runWorkflowChecks({ repositoryRoot, config }).map((problem) => problem.line),
    ).toStrictEqual([3, 5, 7, 7]);
  });

  it("reports only that a definition cannot be read when its syntax is broken", () => {
    const repositoryRoot = repositoryWith("unreadable", {
      "ci.yml": "jobs:\n build:\n   x: 1\n  y: 2\n",
    });

    expect(
      runWorkflowChecks({ repositoryRoot, config }).map((problem) => problem.message),
    ).toStrictEqual([
      "A workflow definition that does not parse must not stay in the repository, because every check below reads it as an empty file and reports nothing. Fix the YAML here so the definition can be read.",
    ]);
  });

  it("orders the problems by the file they were found in", () => {
    const repositoryRoot = repositoryWith("several", {
      "ci.yml": "jobs:\n  build:\n    steps: []\n",
      "release.yml": "jobs:\n  publish:\n    steps: []\n",
    });

    expect(
      runWorkflowChecks({ repositoryRoot, config }).map((problem) => problem.file),
    ).toStrictEqual([".github/workflows/ci.yml", ".github/workflows/release.yml"]);
  });
});
