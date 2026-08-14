import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runChecks } from "../src/run-checks.ts";
import { scanTraceFor } from "../src/scan-trace/scan-trace-report.ts";

const GATED_WORKFLOW = `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`;

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-scan-trace-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([fileName, source]) => {
      const absolutePath = join(repositoryRoot, fileName);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

describe("検査の走査証跡", () => {
  it("観点ごとに、開いた対象の数を残す", async () => {
    const repositoryRoot = await repositoryWith({
      "renovate.json": `{}\n`,
      ".github/workflows/ci.yml": GATED_WORKFLOW,
    });

    const scanned = runChecks(repositoryRoot).outcomes.map((ranCheck) => [
      ranCheck.check,
      ranCheck.count,
    ]);

    expect(scanned).toStrictEqual([
      ["entry-composition", 0],
      ["canonical-values", 0],
      ["equivalent-concepts", 0],
      ["duplicated-bodies", 0],
      ["workflow-definitions", 1],
      ["action-updates", 1],
      ["lint-rule-index", 0],
      ["dependency-declarations", 0],
      ["required-file-form", 1],
      ["preset-adoption", 0],
      ["telemetry-wiring", 0],
      ["shippable-packages", 0],
      ["intent-skills", 0],
    ]);
  });

  it("対象を持てなかった観点に、開かなかった理由を持たせる", async () => {
    const repositoryRoot = await repositoryWith({ "package.json": `{"name": "solo"}` });

    const skipped = runChecks(repositoryRoot)
      .outcomes.filter((ranCheck) => ranCheck.skippedReason !== null)
      .map((ranCheck) => [ranCheck.check, ranCheck.skippedReason]);

    expect(skipped).toStrictEqual([
      ["action-updates", "no workflow definition"],
      ["dependency-declarations", "no workspace definition"],
      ["preset-adoption", "no toolchain configuration"],
    ]);
  });

  it("設定を持つリポジトリでは preset adoption を走査済みとして残す", async () => {
    const repositoryRoot = await repositoryWith({
      "package.json": `{"name": "solo"}`,
      "vite.config.ts": "export default defineConfig({ lint: { rules: {} } });\n",
    });

    const presetAdoption = runChecks(repositoryRoot).outcomes.find(
      (presetAdoptionRun) => presetAdoptionRun.check === "preset-adoption",
    );

    expect(presetAdoption?.skippedReason).toBeNull();
  });

  it("人間が読む形では、状態の記号と対象の規模を観点ごとに桁で揃えて並べる", async () => {
    const repositoryRoot = await repositoryWith({
      "renovate.json": `{}\n`,
      ".github/workflows/ci.yml": GATED_WORKFLOW,
    });
    const { outcomes } = runChecks(repositoryRoot);

    expect(scanTraceFor({ outcomes, readByAgent: false, colored: false })).toMatchInlineSnapshot(`
      "  ✓ entry-composition        0 manifests
        ✓ canonical-values         0 source files
        ✓ equivalent-concepts      0 concepts
        ✓ duplicated-bodies        0 declaration sources
        ✓ workflow-definitions     1 definition
        ✓ action-updates           1 update configuration
        ✓ lint-rule-index          0 workspaces
        ⊘ dependency-declarations  skipped — no workspace definition
        ✓ required-file-form       1 package root
        ⊘ preset-adoption          skipped — no toolchain configuration
        ✓ telemetry-wiring         0 package roots
        ✓ shippable-packages       0 manifests
        ✓ intent-skills            0 manifests

        13 checks ran, nothing to report
      "
    `);
  });

  it("AI が読む形では、記号も桁揃えも持たせずに 1 行 1 観点で並べる", async () => {
    const repositoryRoot = await repositoryWith({
      "renovate.json": `{}\n`,
      ".github/workflows/ci.yml": GATED_WORKFLOW,
    });
    const { outcomes } = runChecks(repositoryRoot);

    expect(scanTraceFor({ outcomes, readByAgent: true, colored: false })).toMatchInlineSnapshot(`
      "checked entry-composition 0 manifests 0 problems 0 warnings
      checked canonical-values 0 source files 0 problems 0 warnings
      checked equivalent-concepts 0 concepts 0 problems 0 warnings
      checked duplicated-bodies 0 declaration sources 0 problems 0 warnings
      checked workflow-definitions 1 definition 0 problems 0 warnings
      checked action-updates 1 update configuration 0 problems 0 warnings
      checked lint-rule-index 0 workspaces 0 problems 0 warnings
      skipped dependency-declarations no workspace definition
      checked required-file-form 1 package root 0 problems 0 warnings
      skipped preset-adoption no toolchain configuration
      checked telemetry-wiring 0 package roots 0 problems 0 warnings
      checked shippable-packages 0 manifests 0 problems 0 warnings
      checked intent-skills 0 manifests 0 problems 0 warnings
      "
    `);
  });

  it("違反を見つけた観点を、その件数とともに残す", async () => {
    const repositoryRoot = await repositoryWith({
      "renovate.json": `{}\n`,
      ".github/workflows/ci.yml": "jobs:\n  build:\n    steps: []\n",
    });

    const reported = runChecks(repositoryRoot)
      .outcomes.filter((ranCheck) => ranCheck.problems.length > 0)
      .map((ranCheck) => [ranCheck.check, ranCheck.problems.length]);

    expect(reported).toStrictEqual([["workflow-definitions", 1]]);
  });
});
