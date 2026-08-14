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
};

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-preset-adoption-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([name, source]) => {
      const target = join(repositoryRoot, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

const adoptingConfig = (lint: string): string => `import {
  oxlint as preset,
  withGitExcludes,
} from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";
export default defineConfig({
  lint: withGitExcludes({ extends: [preset], ${lint} }),
});`;

describe("preset の適用範囲の検査", () => {
  it("vite.config.ts があるリポジトリでは値として静的 import した preset を root lint.extends から直接ちょうど 1 回参照させる", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": `import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [oxlint] } };`,
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("named alias と namespace のどちらでも正規 module から直接参照する preset を採用済みとみなす", async () => {
    const sources = [
      `import * as preset from "@mst/dont-review-it";
import * as vite from "vite-plus";
export default vite.defineConfig({
  lint: preset.withGitExcludes({ extends: [preset.oxlint] }),
});`,
      `import {
  oxlint as preset,
  withGitExcludes as wrap,
} from "@mst/dont-review-it";
import { defineConfig as configure } from "vite-plus";
export default configure({ lint: wrap({ extends: [preset] }) });`,
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

  it("type-only import と別 module と動的 import と local relay と computed member と spread と重複を preset の直接採用として通さない", async () => {
    const sources = [
      `import type { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [oxlint] } };`,
      `import { oxlint } from "another-preset";
export default { lint: { extends: [oxlint] } };`,
      `const { oxlint } = await import("@mst/dont-review-it");
export default { lint: { extends: [oxlint] } };`,
      `import { oxlint } from "@mst/dont-review-it";
const relayed = oxlint;
export default { lint: { extends: [relayed] } };`,
      `import * as preset from "@mst/dont-review-it";
export default { lint: { extends: [preset["oxlint"]] } };`,
      `import { oxlint } from "@mst/dont-review-it";
import { companions } from "another-preset";
export default { lint: { extends: [oxlint, ...companions] } };`,
      `import { oxlint } from "@mst/dont-review-it";
export default { lint: { extends: [oxlint, oxlint] } };`,
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

  it("preset rule を off と allow と 0 またはそれらを先頭に置く配列で止めた宣言をすべて検出する", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": adoptingConfig(`rules: {
        "dont-review-it/first": "off",
        "dont-review-it/second": ["allow", {}],
        "dont-review-it/third": 0,
        "dont-review-it/fourth": ["off"],
        "dont-review-it/fifth": "allow",
        "dont-review-it/sixth": [0, {}],
      }`),
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).problems).toHaveLength(24);
  });

  it("EDR に記録された 2 workspace と 1 rule の完全一致だけを warning に留める", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": adoptingConfig(`overrides: [{
        files: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
        rules: {
          "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": "off",
        },
      }]`),
    });

    const report = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(report.problems).toStrictEqual([]);
    expect(report.warnings).toHaveLength(2);
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

  it("rules と overrides と severity と files と excludeFiles の有効値を静的に追えない設定を problem にする", async () => {
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
