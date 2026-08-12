import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { actionUpdateProblems } from "./action-updates.ts";
import { defaultWorkflowChecksConfig } from "./config.ts";

const config = defaultWorkflowChecksConfig;

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-dependency-updates-"));

const reportFor = (fixtureName: string, files: Readonly<Record<string, string>>) => {
  const repositoryRoot = join(fixtureDir, fixtureName);
  mkdirSync(repositoryRoot, { recursive: true });
  Object.entries(files).forEach(([relativePath, source]) => {
    const workflowPath = join(repositoryRoot, relativePath);
    mkdirSync(dirname(workflowPath), { recursive: true });
    writeFileSync(workflowPath, source);
  });
  return actionUpdateProblems({ repositoryRoot, config });
};

const problemsFor = (fixtureName: string, files: Readonly<Record<string, string>>) =>
  reportFor(fixtureName, files).problems;

const DEPENDABOT_PATH = ".github/dependabot.yml";

describe("actionUpdateProblems", () => {
  it("reports a repository that names no mechanism at all", () => {
    expect(problemsFor("bare", {})[0]?.message).toContain("must not leave the pins without");
  });

  it("points at the workflow directory when nothing raises the pins", () => {
    expect(problemsFor("bare-location", {})[0]?.file).toBe(config.workflowDirectory);
  });

  it("leaves a repository that configures Renovate alone", () => {
    expect(problemsFor("renovate", { "renovate.json": "{}\n" })).toStrictEqual([]);
  });

  it("accepts the configuration Renovate reads from the platform directory", () => {
    expect(problemsFor("renovate-github", { ".github/renovate.json5": "{}\n" })).toStrictEqual([]);
  });

  it("leaves a Dependabot configuration that covers the actions alone", () => {
    expect(
      problemsFor("dependabot-covering", {
        [DEPENDABOT_PATH]: `version: 2\nupdates:\n  - package-ecosystem: github-actions\n    directory: /\n`,
      }),
    ).toStrictEqual([]);
  });

  it("reports a Dependabot configuration that covers everything but the actions", () => {
    expect(
      problemsFor("dependabot-partial", {
        [DEPENDABOT_PATH]: `version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n`,
      })[0]?.message,
    ).toContain("must not leave the workflows out");
  });

  it("counts the mechanism it found", () => {
    expect(reportFor("renovate-count", { "renovate.json": "{}\n" }).scanned).toBe(1);
  });

  it("counts nothing when it found no mechanism", () => {
    expect(reportFor("bare-count", {}).scanned).toBe(0);
  });

  it("points at the configuration that left the actions out", () => {
    expect(
      problemsFor("dependabot-partial-location", {
        [DEPENDABOT_PATH]: `version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n`,
      })[0]?.file,
    ).toBe(DEPENDABOT_PATH);
  });
});
