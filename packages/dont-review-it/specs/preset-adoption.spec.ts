import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "../src/preset-adoption/config.ts";
import { runPresetAdoptionChecks } from "../src/preset-adoption/run-preset-adoption-checks.ts";

const config = defaultPresetAdoptionConfig;

const WORKSPACES = {
  "package.json": `{"name": "root"}`,
  "packages/ai-native/package.json": `{"name": "ai-native"}`,
  "packages/left/package.json": `{"name": "left"}`,
  "packages/lint-rule-authoring/package.json": `{"name": "lint-rule-authoring"}`,
  "packages/right/package.json": `{"name": "right"}`,
  "packages/verified-specifications/package.json": `{"name": "verified-specifications"}`,
};

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-preset-adoption-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([relativePath, writtenSource]) => {
      const writtenPath = join(repositoryRoot, relativePath);
      await mkdir(dirname(writtenPath), { recursive: true });
      await writeFile(writtenPath, writtenSource, "utf-8");
    }),
  );
  return repositoryRoot;
};

const adoptingConfig = (lint: string): string => `import {
  dontReviewItPreset as preset,
} from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "vite-plus";
export default defineConfig({
  lint: preset.lint({ ${lint} }),
});`;

describe("preset の適用範囲の検査", () => {
  it("vite.config.ts があるリポジトリでは値として静的 import した dontReviewItPreset の lint 関数へ object literal を直接渡す", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}) };`,
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("named alias と namespace のどちらでも正規 module から直接参照する preset を採用済みとみなす", async () => {
    const sources = [
      `import * as preset from "@mst/dont-review-it";
import * as vite from "vite-plus";
export default vite.defineConfig({
  lint: preset.dontReviewItPreset.lint({}),
});`,
      `import {
  dontReviewItPreset as preset,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
export default configure({ lint: preset.lint({}) });`,
    ];
    const reports = await Promise.all(
      sources.map(async (source) => {
        const repositoryRoot = await repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": source,
        });
        return runPresetAdoptionChecks({ repositoryRoot, config });
      }),
    );

    expect(reports.every((report) => report.problems.length === 0)).toBe(true);
  });

  it("severity の named alias と namespace を配列先頭から正規 module へ直接たどる", async () => {
    const sources = [
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY as LEVEL } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": [LEVEL.ERROR, {}],
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import * as lintRuleAuthoring from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": [lintRuleAuthoring.LINT_SEVERITY.ERROR, {}],
} }) };`,
    ];
    const reports = await Promise.all(
      sources.map(async (source) => {
        const repositoryRoot = await repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": source,
        });
        return runPresetAdoptionChecks({ repositoryRoot, config });
      }),
    );

    expect(
      reports.map((report) => ({
        problems: report.problems,
        warnings: report.warnings,
      })),
    ).toStrictEqual([
      { problems: [], warnings: [] },
      { problems: [], warnings: [] },
    ]);
  });

  it("type-only import と別 module と動的 import と local relay と computed member と spread と重複を preset の直接呼出しとして通さない", async () => {
    const sources = [
      `import type { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}) };`,
      `import { dontReviewItPreset } from "another-preset";
export default { lint: dontReviewItPreset.lint({}) };`,
      `const { dontReviewItPreset } = await import("@mst/dont-review-it");
export default { lint: dontReviewItPreset.lint({}) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
const relayed = dontReviewItPreset;
export default { lint: relayed.lint({}) };`,
      `import * as preset from "@mst/dont-review-it";
export default { lint: preset["dontReviewItPreset"].lint({}) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint(...sharedLint) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
export default {
  lint: dontReviewItPreset.lint({}),
  lint: dontReviewItPreset.lint({}),
};`,
    ];
    const reports = await Promise.all(
      sources.map(async (source) => {
        const repositoryRoot = await repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": source,
        });
        return runPresetAdoptionChecks({ repositoryRoot, config });
      }),
    );

    expect(reports.every((report) => report.problems.length > 0)).toBe(true);
  });

  it("preset rule を off と allow と 0 と名前付き定数またはそれらを先頭に置く配列で止めた宣言をすべて検出する", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": adoptingConfig(`rules: {
        "dont-review-it/first": "off",
        "dont-review-it/second": ["allow", {}],
        "dont-review-it/third": 0,
        "dont-review-it/fourth": ["off"],
        "dont-review-it/fifth": "allow",
        "dont-review-it/sixth": [0, {}],
        "dont-review-it/seventh": LINT_SEVERITY.OFF,
        "dont-review-it/eighth": [LINT_SEVERITY.OFF, {}],
      }`),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems).toHaveLength(40);
  });

  it("preset rule を warn と 1 と名前付き定数またはそれらを先頭に置く配列へ下げた宣言をすべて problem にする", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": adoptingConfig(`rules: {
        "dont-review-it/first": "warn",
        "dont-review-it/second": ["warn", {}],
        "dont-review-it/third": 1,
        "dont-review-it/fourth": [1, {}],
        "dont-review-it/fifth": LINT_SEVERITY.WARN,
        "dont-review-it/sixth": [LINT_SEVERITY.WARN, {}],
      }`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect({ problems: report.problems.length, warnings: report.warnings }).toStrictEqual({
      problems: 6,
      warnings: [],
    });
  });

  it("正規 module から値 import した LINT_SEVERITY 以外の member を severity とみなさない", async () => {
    const sources = [
      `const fake = { ERROR: "off" };
import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": fake.ERROR,
} }) };`,
      `const fake = { OFF: "error" };
import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": fake.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "another-module";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": LINT_SEVERITY.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import type { LINT_SEVERITY } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": LINT_SEVERITY.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
const { LINT_SEVERITY } = await import("@mst/lint-rule-authoring");
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": LINT_SEVERITY.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
const relayed = LINT_SEVERITY;
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": relayed.OFF,
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": LINT_SEVERITY["OFF"],
} }) };`,
      `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({ rules: {
  "dont-review-it/rule": [...severities],
} }) };`,
    ];
    const reports = await Promise.all(
      sources.map(async (source) => {
        const repositoryRoot = await repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": source,
        });
        return runPresetAdoptionChecks({ repositoryRoot, config });
      }),
    );

    expect({
      reportCount: reports.length,
      allRejectedAtSeverity: reports.every((report) =>
        report.problems.some((problem) =>
          problem.message.includes("statically imported LINT_SEVERITY.ERROR"),
        ),
      ),
      allWarningsEmpty: reports.every((report) => report.warnings.length === 0),
    }).toStrictEqual({ reportCount: 8, allRejectedAtSeverity: true, allWarningsEmpty: true });
  });

  it("EDR に記録された 3 workspace と 1 rule の完全一致だけを warning に留める", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": adoptingConfig(`overrides: [{
        files: [
          "packages/ai-native/**",
          "packages/lint-rule-authoring/**",
          "packages/verified-specifications/**",
        ],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
        },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.problems).toStrictEqual([]);
    expect(report.warnings).toHaveLength(3);
  });

  it("EDR に記録された完全一致の例外を複数宣言したら全宣言を problem にする", async () => {
    const exception = `{
      files: [
        "packages/ai-native/**",
        "packages/lint-rule-authoring/**",
        "packages/verified-specifications/**",
      ],
      rules: {
        "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.OFF,
      },
    }`;
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": adoptingConfig(`overrides: [${exception}, ${exception}]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect({ problems: report.problems.length, warnings: report.warnings.length }).toStrictEqual({
      problems: 6,
      warnings: 0,
    });
  });

  it("EDR の完全一致以外で止めた preset rule を warning ではなく problem にする", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": adoptingConfig(`overrides: [{
        files: ["packages/left/**"],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off",
        },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.problems).toHaveLength(1);
    expect(report.warnings).toStrictEqual([]);
  });

  it("preset rule を止め得る rules と overrides、および disabled preset rule の severity と files と excludeFiles を静的に追えない設定を problem にする", async () => {
    const lintBlocks = [
      `rules: sharedRules`,
      `overrides: sharedOverrides`,
      `overrides: [{
        files: ["packages/**"],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": severity },
      }]`,
      `overrides: [{
        files: [pathPattern],
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      }]`,
      `overrides: [{
        files: ["packages/**"],
        excludeFiles: excludedPaths,
        rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" },
      }]`,
    ];
    const reports = await Promise.all(
      lintBlocks.map(async (lint) => {
        const repositoryRoot = await repositoryWith({
          ...WORKSPACES,
          "vite.config.ts": adoptingConfig(lint),
        });
        return runPresetAdoptionChecks({ repositoryRoot, config });
      }),
    );

    expect(reports.every((report) => report.problems.length > 0)).toBe(true);
  });

  it("vite.config.ts が無いリポジトリには preset の導入を要求しない", async () => {
    const repositoryRoot = await repositoryWith(WORKSPACES);

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.configMissing).toBe(true);
    expect(report.problems).toStrictEqual([]);
  });
});
