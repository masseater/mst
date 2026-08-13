import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { actionUpdateProblems } from "./action-updates.ts";
import { defaultWorkflowChecksConfig } from "./config.ts";

const MISSING_MECHANISM_MESSAGE =
  "A repository that pins its action references must not leave the pins without something that raises them, because a pin holds an action at the version it had on the day it was written and nothing afterwards notices that the version aged. Which pin is current cannot be settled by reading this repository, so what is required here is the mechanism rather than the answer. Add a Renovate configuration, or a Dependabot configuration whose `updates` cover the `github-actions` ecosystem, so every pinned commit SHA is raised in a pull request that a person reviews.";

const WORKFLOWS_LEFT_OUT_MESSAGE =
  "A dependency update configuration must not leave the workflows out, because the actions they pin run with more access than anything else in the repository and are read by nobody once pinned. Add an entry to `updates` whose `package-ecosystem` is `github-actions`, so the pinned commit SHAs are raised alongside the rest of the dependencies.";

describe("actionUpdateProblems", () => {
  describe("a repository that names no update mechanism at all", () => {
    const it = test.extend("reportForARepositoryNamingNoMechanism", () =>
      actionUpdateProblems({
        repositoryRoot: mkdtempSync(join(tmpdir(), "action-updates-bare-")),
        config: defaultWorkflowChecksConfig,
      }));

    it("reports a repository that names no mechanism at all", ({
      reportForARepositoryNamingNoMechanism,
    }) => {
      expect(reportForARepositoryNamingNoMechanism).toStrictEqual({
        problems: [
          {
            file: ".github/workflows",
            line: null,
            message: MISSING_MECHANISM_MESSAGE,
          },
        ],
        scanned: 0,
      });
    });
  });

  describe("a repository where nothing raises the pins", () => {
    const it = test.extend("reportForARepositoryWherePinsGoUnraised", () =>
      actionUpdateProblems({
        repositoryRoot: mkdtempSync(join(tmpdir(), "action-updates-bare-location-")),
        config: defaultWorkflowChecksConfig,
      }));

    it("points at the workflow directory when nothing raises the pins", ({
      reportForARepositoryWherePinsGoUnraised,
    }) => {
      expect(reportForARepositoryWherePinsGoUnraised).toStrictEqual({
        problems: [
          {
            file: ".github/workflows",
            line: null,
            message: MISSING_MECHANISM_MESSAGE,
          },
        ],
        scanned: 0,
      });
    });
  });

  describe("a repository carrying a Renovate configuration at its root", () => {
    const it = test.extend("reportForARepositoryConfiguringRenovate", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "action-updates-renovate-"));
      writeFileSync(join(repositoryRoot, "renovate.json"), "{}\n");
      return actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("leaves a repository that configures Renovate alone", ({
      reportForARepositoryConfiguringRenovate,
    }) => {
      expect(reportForARepositoryConfiguringRenovate).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a repository carrying a Renovate configuration in the platform directory", () => {
    const it =
      test.extend("reportForARepositoryConfiguringRenovateUnderThePlatformDirectory", () => {
        const repositoryRoot = mkdtempSync(join(tmpdir(), "action-updates-renovate-github-"));
        mkdirSync(join(repositoryRoot, ".github"), { recursive: true });
        writeFileSync(join(repositoryRoot, ".github", "renovate.json5"), "{}\n");
        return actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
      });

    it("accepts the configuration Renovate reads from the platform directory", ({
      reportForARepositoryConfiguringRenovateUnderThePlatformDirectory,
    }) => {
      expect(reportForARepositoryConfiguringRenovateUnderThePlatformDirectory).toStrictEqual({
        problems: [],
        scanned: 1,
      });
    });
  });

  describe("a Dependabot configuration whose updates cover the actions", () => {
    const it = test.extend("reportForADependabotConfigurationCoveringTheActions", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "action-updates-dependabot-covering-"));
      mkdirSync(join(repositoryRoot, ".github"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, ".github", "dependabot.yml"),
        "version: 2\nupdates:\n  - package-ecosystem: github-actions\n    directory: /\n",
      );
      return actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("leaves a Dependabot configuration that covers the actions alone", ({
      reportForADependabotConfigurationCoveringTheActions,
    }) => {
      expect(reportForADependabotConfigurationCoveringTheActions).toStrictEqual({
        problems: [],
        scanned: 1,
      });
    });
  });

  describe("a Dependabot configuration whose updates cover everything but the actions", () => {
    const it = test.extend("reportForADependabotConfigurationSkippingTheActions", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "action-updates-dependabot-partial-"));
      mkdirSync(join(repositoryRoot, ".github"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, ".github", "dependabot.yml"),
        "version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n",
      );
      return actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("reports a Dependabot configuration that covers everything but the actions", ({
      reportForADependabotConfigurationSkippingTheActions,
    }) => {
      expect(reportForADependabotConfigurationSkippingTheActions).toStrictEqual({
        problems: [
          {
            file: ".github/dependabot.yml",
            line: 1,
            message: WORKFLOWS_LEFT_OUT_MESSAGE,
          },
        ],
        scanned: 1,
      });
    });
  });

  describe("a repository whose single mechanism is counted", () => {
    const it = test.extend("reportForACountedRenovateConfiguration", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "action-updates-renovate-count-"));
      writeFileSync(join(repositoryRoot, "renovate.json"), "{}\n");
      return actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("counts the mechanism it found", ({ reportForACountedRenovateConfiguration }) => {
      expect(reportForACountedRenovateConfiguration).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a repository holding no mechanism to count", () => {
    const it = test.extend("reportForARepositoryHoldingNothingToCount", () =>
      actionUpdateProblems({
        repositoryRoot: mkdtempSync(join(tmpdir(), "action-updates-bare-count-")),
        config: defaultWorkflowChecksConfig,
      }));

    it("counts nothing when it found no mechanism", ({
      reportForARepositoryHoldingNothingToCount,
    }) => {
      expect(reportForARepositoryHoldingNothingToCount).toStrictEqual({
        problems: [
          {
            file: ".github/workflows",
            line: null,
            message: MISSING_MECHANISM_MESSAGE,
          },
        ],
        scanned: 0,
      });
    });
  });

  describe("a Dependabot configuration that left the actions out", () => {
    const it = test.extend("reportLocatingTheDependabotConfigurationThatLeftTheActionsOut", () => {
      const repositoryRoot = mkdtempSync(
        join(tmpdir(), "action-updates-dependabot-partial-location-"),
      );
      mkdirSync(join(repositoryRoot, ".github"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, ".github", "dependabot.yml"),
        "version: 2\nupdates:\n  - package-ecosystem: npm\n    directory: /\n",
      );
      return actionUpdateProblems({ repositoryRoot, config: defaultWorkflowChecksConfig });
    });

    it("points at the configuration that left the actions out", ({
      reportLocatingTheDependabotConfigurationThatLeftTheActionsOut,
    }) => {
      expect(reportLocatingTheDependabotConfigurationThatLeftTheActionsOut).toStrictEqual({
        problems: [
          {
            file: ".github/dependabot.yml",
            line: 1,
            message: WORKFLOWS_LEFT_OUT_MESSAGE,
          },
        ],
        scanned: 1,
      });
    });
  });
});
