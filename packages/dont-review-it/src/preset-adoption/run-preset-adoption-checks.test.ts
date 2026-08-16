import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { runPresetAdoptionChecks } from "./run-preset-adoption-checks.ts";

const TWO_WORKSPACES = {
  "package.json": `{ "name": "root" }`,
  "packages/left/package.json": `{ "name": "left" }`,
  "packages/right/package.json": `{ "name": "right" }`,
};

const THREE_WORKSPACES = {
  ...TWO_WORKSPACES,
  "packages/middle/package.json": `{ "name": "middle" }`,
};

describe("runPresetAdoptionChecks", () => {
  describe("a configuration switching off a preset rule that no bundle carries", () => {
    const it = test.extend("reportOverARuleNoBundleCarries", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default defineConfig({
  lint: { rules: { "dont-review-it/no-such-rule--do-something": "off" } },
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("names the workspaces it stops reaching, as it does for any preset rule", ({
      reportOverARuleNoBundleCarries,
    }) => {
      expect(reportOverARuleNoBundleCarries).toStrictEqual({
        warnings: [
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "The lint configuration must not leave dont-review-it/no-such-rule--do-something switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
          },
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "The lint configuration must not leave dont-review-it/no-such-rule--do-something switched off for packages/right. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
          },
        ],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a configuration switching off a rule of a bundle it never names", () => {
    const it = test.extend("reportOverAnUnadoptedBundle", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default defineConfig({
  lint: dontReviewItPreset.lint({
    bundles: ["testing"],
    rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
  }),
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("says the override stops nothing", ({ reportOverAnUnadoptedBundle }) => {
      expect(reportOverAnUnadoptedBundle).toStrictEqual({
        warnings: [
          {
            file: "vite.config.ts",
            line: 4,
            message:
              "The lint configuration must not switch dont-review-it/no-reassign--use-spread-or-iife off while it does not carry the mutation-and-failure bundle, because the override stops nothing. Delete the override, or name that bundle where the preset is called.",
          },
        ],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a configuration that switches nothing off", () => {
    const it = test.extend("reportOverAConfigurationSwitchingNothingOff", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("says nothing about the repository", ({ reportOverAConfigurationSwitchingNothingOff }) => {
      expect(reportOverAConfigurationSwitchingNothingOff).toStrictEqual({
        warnings: [],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a repository holding three workspaces", () => {
    const it = test.extend("reportOverThreeWorkspaces", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...THREE_WORKSPACES,
        "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("counts every workspace it held the configuration against", ({
      reportOverThreeWorkspaces,
    }) => {
      expect(reportOverThreeWorkspaces).toStrictEqual({
        warnings: [],
        scanned: 3,
        configMissing: false,
      });
    });
  });

  describe("an override that names one workspace", () => {
    const it = test.extend("reportOverAnOverrideNamingOneWorkspace", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default defineConfig({
  lint: {
    overrides: [
      {
        files: ["packages/left/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      },
    ],
  },
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("names only the workspace the override reaches", ({
      reportOverAnOverrideNamingOneWorkspace,
    }) => {
      expect(reportOverAnOverrideNamingOneWorkspace).toStrictEqual({
        warnings: [
          {
            file: "vite.config.ts",
            line: 6,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
          },
        ],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a rule switched off without a path", () => {
    const it = test.extend("reportOverARuleSwitchedOffWithoutAPath", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("names every workspace the configuration covers", ({
      reportOverARuleSwitchedOffWithoutAPath,
    }) => {
      expect(reportOverARuleSwitchedOffWithoutAPath).toStrictEqual({
        warnings: [
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
          },
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
          },
        ],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("an override written on one line", () => {
    const it = test.extend("reportOverAnOverrideWrittenOnOneLine", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries({
        ...TWO_WORKSPACES,
        "vite.config.ts": `export default defineConfig({
  lint: { overrides: [{ files: ["packages/right/**"], rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } }] },
});`,
      })) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("points at the line the configuration switches the rule off on", ({
      reportOverAnOverrideWrittenOnOneLine,
    }) => {
      expect(reportOverAnOverrideWrittenOnOneLine).toStrictEqual({
        warnings: [
          {
            file: "vite.config.ts",
            line: 2,
            message:
              "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
          },
        ],
        scanned: 2,
        configMissing: false,
      });
    });
  });

  describe("a repository without a toolchain configuration", () => {
    const it = test.extend("reportOverARepositoryWithoutAToolchainConfiguration", () => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
      onTestFinished(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      for (const [relativePath, writtenSource] of Object.entries(TWO_WORKSPACES)) {
        const writtenPath = join(repositoryRoot, relativePath);
        mkdirSync(dirname(writtenPath), { recursive: true });
        writeFileSync(writtenPath, writtenSource, "utf8");
      }
      return runPresetAdoptionChecks({ repositoryRoot, config: defaultPresetAdoptionConfig });
    });

    it("reports nothing and says why", ({
      reportOverARepositoryWithoutAToolchainConfiguration,
    }) => {
      expect(reportOverARepositoryWithoutAToolchainConfiguration).toStrictEqual({
        warnings: [],
        scanned: 2,
        configMissing: true,
      });
    });
  });
});
