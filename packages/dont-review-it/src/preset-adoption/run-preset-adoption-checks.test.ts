import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { runPresetAdoptionChecks } from "./run-preset-adoption-checks.ts";

const config = defaultPresetAdoptionConfig;

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const repositoryRoot = mkdtempSync(join(tmpdir(), "preset-adoption-"));
  onTestFinished(() => {
    rmSync(repositoryRoot, { recursive: true, force: true });
  });
  for (const [relativePath, text] of Object.entries(files)) {
    const target = join(repositoryRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text, "utf8");
  }
  return repositoryRoot;
};

const TWO_WORKSPACES = {
  "package.json": `{ "name": "root" }`,
  "packages/left/package.json": `{ "name": "left" }`,
  "packages/right/package.json": `{ "name": "right" }`,
};

const configHolding = (lint: string): string => `import {
  oxlint as preset,
  withGitExcludes,
} from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: withGitExcludes({ extends: [preset], ${lint} }),
});`;

describe("runPresetAdoptionChecks", () => {
  test("accepts a repository whose root directly adopts the preset and disables nothing", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding("rules: {}"),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.problems).toStrictEqual([]);
    expect(report.warnings).toStrictEqual([]);
  });

  test("counts every workspace it held the configuration against", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding("rules: {}"),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).scanned).toBe(2);
  });

  test("keeps only the exact engineering-decision exception as warnings", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "packages/ai-native/package.json": `{ "name": "ai-native" }`,
      "packages/lint-rule-authoring/package.json": `{ "name": "lint-rule-authoring" }`,
      "vite.config.ts": configHolding(`overrides: [{
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off",
        },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.problems).toStrictEqual([]);
    expect(report.warnings.map((warning) => warning.message)).toStrictEqual([
      "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/ai-native. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
      "The lint configuration must not leave dont-review-it/no-handmade-standard-io-double--use-standard-io-test switched off for packages/lint-rule-authoring. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
    ]);
  });

  test("turns a different disabled preset rule into problems for every reached workspace", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding(`overrides: [{
        files: ["packages/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "allow" },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.warnings).toStrictEqual([]);
    expect(report.problems.map((problem) => problem.message)).toStrictEqual([
      "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
      "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/right. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
    ]);
  });

  test("applies excludeFiles before naming the reached workspaces", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding(`overrides: [{
        files: ["packages/**"],
        excludeFiles: ["packages/right/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": 0 },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.problems.map((problem) => problem.message)).toStrictEqual([
      "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or keep only the exact exception recorded by the repository's engineering decision log.",
    ]);
  });

  test("reports a disabled declaration even when its literal paths reach no workspace", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding(`overrides: [{
        files: ["packages/missing/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      }]`),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems[0]?.message).toContain(
      "packages/missing/**",
    );
  });

  test("reports a root disabled rule against every workspace", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding(
        `rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" }`,
      ),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems).toHaveLength(2);
  });

  test("reports a root disabled rule even when the repository has no workspaces", () => {
    const repositoryRoot = repositoryWith({
      "vite.config.ts": configHolding(
        `rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" }`,
      ),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems[0]?.message).toContain(
      "switched off for the repository",
    );
  });

  test("turns missing direct preset adoption into a problem", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": `export default { lint: { extends: [] } };`,
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems[0]?.message).toContain(
      "exactly once; found 0",
    );
  });

  test("turns an uninspectable rules block into a problem", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding("rules: sharedRules"),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems[0]?.message).toContain(
      "must be an object literal",
    );
  });

  test("does not allow the recorded exception when excludeFiles cannot be inspected", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "packages/ai-native/package.json": `{"name":"ai-native"}`,
      "packages/lint-rule-authoring/package.json": `{"name":"lint-rule-authoring"}`,
      "vite.config.ts": configHolding(`overrides: [{
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        excludeFiles: sharedExcludes,
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off",
        },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.warnings).toStrictEqual([]);
    expect(report.problems.map((problem) => problem.message)).toStrictEqual(
      expect.arrayContaining([
        expect.stringContaining("excludeFiles as a literal array"),
        expect.stringContaining("switched off for packages/ai-native"),
        expect.stringContaining("switched off for packages/lint-rule-authoring"),
      ]),
    );
  });

  test("reports both an uninspectable path and the disabled declaration it contains", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configHolding(`overrides: [{
        files: sharedFiles,
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.problems.map((problem) => problem.message)).toStrictEqual(
      expect.arrayContaining([
        expect.stringContaining("must declare files as a literal array"),
        expect.stringContaining("switched off for packages/left"),
        expect.stringContaining("switched off for packages/right"),
      ]),
    );
  });

  test("reports nothing and says why when the repository has no toolchain configuration", () => {
    const repositoryRoot = repositoryWith(TWO_WORKSPACES);

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report).toStrictEqual({
      problems: [],
      warnings: [],
      scanned: 2,
      configMissing: true,
    });
  });
});
