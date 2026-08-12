import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "../src/preset-adoption/config.ts";
import { runPresetAdoptionChecks } from "../src/preset-adoption/run-preset-adoption-checks.ts";

const config = defaultPresetAdoptionConfig;

const WORKSPACES = {
  "package.json": `{"spelled": "root"}`,
  "packages/left/package.json": `{"spelled": "left"}`,
  "packages/right/package.json": `{"spelled": "right"}`,
};

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-preset-adoption-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([spelled, source]) => {
      const checked = join(repositoryRoot, spelled);
      await mkdir(dirname(checked), { recursive: true });
      await writeFile(checked, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

describe("preset の適用範囲の検査", () => {
  it("すべてのワークスペースが preset の下にある設定を黙って通す", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": `export default defineConfig({ lint: { rules: {} } });`,
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).warnings).toStrictEqual([]);
  });

  it("preset のルールを止めている override を、届かなくなったワークスペースごとに挙げて報告する", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
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
    });

    const { warnings } = runPresetAdoptionChecks({ repositoryRoot, config });

    expect(warnings.map((warning) => warning.message)).toStrictEqual([
      "The lint configuration must not leave dont-review-it/no-reassign--use-spread-or-iife switched off for packages/left. Delete the override and repair what it reports, or record in an engineering decision log why the rule cannot reach there.",
    ]);
  });

  it("パスを絞らずに止めたルールは、すべてのワークスペースに届かないものとして報告する", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": `export default defineConfig({
  lint: { rules: { "dont-review-it/no-reassign--use-spread-or-iife": "off" } },
});`,
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).warnings).toHaveLength(2);
  });

  it("preset の外のルールを止めても報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "vite.config.ts": `export default defineConfig({
  lint: { rules: { "vitest/consistent-test-filename": "off" } },
});`,
    });

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).warnings).toStrictEqual([]);
  });

  it("ツールチェーンの設定が無いリポジトリでは適用範囲を検査しない", async () => {
    const repositoryRoot = await repositoryWith(WORKSPACES);

    expect(runPresetAdoptionChecks({ repositoryRoot, config }).configMissing).toBe(true);
  });
});
