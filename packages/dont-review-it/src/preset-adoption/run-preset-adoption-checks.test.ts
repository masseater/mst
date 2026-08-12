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
  for (const [relativePath, writtenText] of Object.entries(files)) {
    const checked = join(repositoryRoot, relativePath);
    mkdirSync(dirname(checked), { recursive: true });
    writeFileSync(checked, writtenText, "utf8");
  }
  return repositoryRoot;
};

const TWO_WORKSPACES = {
  "package.json": `{ "name": "root" }`,
  "packages/left/package.json": `{ "name": "left" }`,
  "packages/right/package.json": `{ "name": "right" }`,
};

const configTurningOffFor = (files: string): string =>
  `export default defineConfig({
  lint: {
    overrides: [
      {
        files: [${files}],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      },
    ],
  },
});`;

describe("runPresetAdoptionChecks", () => {
  test("says nothing about a repository whose configuration switches nothing off", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.warnings).toStrictEqual([]);
  });

  test("counts every workspace it held the configuration against", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).scanned).toBe(2);
  });

  test("names only the workspace an override reaches", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configTurningOffFor(`"packages/left/**"`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.warnings.map((warning) => warning.message)).toStrictEqual([
      "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
    ]);
  });

  test("names every workspace when the rule is switched off without a path", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.warnings.map((warning) => warning.file)).toStrictEqual([
      "vite.config.ts",
      "vite.config.ts",
    ]);
  });

  test("points at the line the configuration switches the rule off on", () => {
    const repositoryRoot = repositoryWith({
      ...TWO_WORKSPACES,
      "vite.config.ts": configTurningOffFor(`"packages/right/**"`),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).warnings[0]?.line).toBe(6);
  });

  test("reports nothing and says why when the repository has no toolchain configuration", () => {
    const repositoryRoot = repositoryWith(TWO_WORKSPACES);

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report).toStrictEqual({ warnings: [], scanned: 2, configMissing: true });
  });
});
