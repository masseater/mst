import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { LINT_BUNDLE, type LintBundleSelection } from "../src/configs/bundles/bundle-names.ts";
import { BUNDLE_RULES } from "../src/configs/oxlint.ts";
import { dontReviewItPreset } from "../src/index.ts";
import { runChecks } from "../src/run-checks.ts";

const RULES_DIRECTORY = join(import.meta.dirname, "../src/lint/oxlint/rules");

const placedRuleNamesIn = async ({
  bundle,
  directories,
}: {
  readonly bundle: string;
  readonly directories: ReadonlySet<string>;
}): Promise<readonly string[]> => {
  if (!directories.has(bundle)) return [];
  const fileNames = await readdir(join(RULES_DIRECTORY, bundle));
  return fileNames
    .filter((fileName) => fileName.endsWith(".ts") && !fileName.endsWith(".test.ts"))
    .map((fileName) => fileName.slice(0, -".ts".length));
};

const strayRuleNames = async (): Promise<readonly string[]> => {
  const listed = await readdir(RULES_DIRECTORY, { withFileTypes: true });
  const directories = new Set(
    listed.filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name),
  );
  const perBundle = await Promise.all(
    Object.entries(BUNDLE_RULES).map(async ([bundle, rules]) => {
      const placed = await placedRuleNamesIn({ bundle, directories });
      const declared: readonly string[] = rules.map((rule) => rule.name);
      return [
        ...placed.filter((ruleName) => !declared.includes(ruleName)),
        ...declared.filter((ruleName) => !placed.includes(ruleName)),
      ].map((ruleName) => `${bundle}/${ruleName}`);
    }),
  );
  return perBundle.flat().toSorted();
};

const PLUGIN_PREFIX = "dont-review-it/";

const ruleIdsFor = (bundles: LintBundleSelection): readonly string[] =>
  (dontReviewItPreset.lint({ bundles }).extends ?? [])
    .filter((extended) => typeof extended !== "string")
    .flatMap((extended) => Object.keys(extended.rules ?? {}))
    .filter((ruleId) => ruleId.startsWith(PLUGIN_PREFIX));

const GOVERNANCE_RULE = `${PLUGIN_PREFIX}no-blanket-suppression--name-and-record`;

const WRITING_RULE = `${PLUGIN_PREFIX}no-default-export--use-named-export`;

const TESTING_RULE = `${PLUGIN_PREFIX}require-it-only-expect--move-setup-into-fixture`;

const SINGLE_OWNERSHIP_RULE = `${PLUGIN_PREFIX}no-twin-declaration--merge-into-one-owner`;

describe("束ごとの採用", () => {
  it("束が持つルールと、その束のディレクトリに立っているルールが一致している", async () => {
    expect(await strayRuleNames()).toStrictEqual([]);
  });

  it("すべてを採ると、どの束のルールも入る", () => {
    const ruleIds = ruleIdsFor("all");

    expect(ruleIds).toContain(GOVERNANCE_RULE);
    expect(ruleIds).toContain(WRITING_RULE);
    expect(ruleIds).toContain(TESTING_RULE);
    expect(ruleIds).toContain(SINGLE_OWNERSHIP_RULE);
  });

  it("名指しした束のルールだけが入る", () => {
    const ruleIds = ruleIdsFor([LINT_BUNDLE.testing]);

    expect(ruleIds).toContain(TESTING_RULE);
    expect(ruleIds).not.toContain(WRITING_RULE);
    expect(ruleIds).not.toContain(SINGLE_OWNERSHIP_RULE);
  });

  it("報告を消す経路を塞ぐ束は、名指ししなくても入る", () => {
    const ruleIds = ruleIdsFor([]);

    expect(ruleIds).toContain(GOVERNANCE_RULE);
  });

  it("報告を消す経路を塞ぐ束だけを名指ししても、二重には入らない", () => {
    const ruleIds = ruleIdsFor([LINT_BUNDLE.governance]);

    expect(ruleIds.filter((ruleId) => ruleId === GOVERNANCE_RULE)).toStrictEqual([GOVERNANCE_RULE]);
  });

  it("採っていない束の検査は、走らせずに理由を添えて並べる", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-bundles-"));
    onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));
    await writeFile(
      join(repositoryRoot, "vite.config.ts"),
      `import { dontReviewItPreset } from "@mst/dont-review-it";
import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: dontReviewItPreset.lint({ bundles: ["testing"] }),
});
`,
      "utf-8",
    );
    const byCheck = new Map(
      runChecks(repositoryRoot).outcomes.map((ranCheck) => [
        ranCheck.check,
        ranCheck.skippedReason,
      ]),
    );

    expect(byCheck.get("canonical-values")).toBe("bundle not adopted");
    expect(byCheck.get("workflow-definitions")).toBe("bundle not adopted");
    expect(byCheck.get("shippable-packages")).toBe("bundle not adopted");
  });

  it("束を名指ししていないツールチェーン設定では、どの検査も走る", async () => {
    const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-bundles-"));
    onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));
    const skipped = runChecks(repositoryRoot).outcomes.filter(
      (ranCheck) => ranCheck.skippedReason === "bundle not adopted",
    );

    expect(skipped).toStrictEqual([]);
  });

  it("テストの束を採らないと、仕様担保テストの置き場に与える設定も入らない", () => {
    const withoutTesting = dontReviewItPreset.lint({ bundles: [LINT_BUNDLE.writing] });
    const carried = (withoutTesting.extends ?? [])
      .filter((extended) => typeof extended !== "string")
      .flatMap((extended) => extended.overrides ?? []);

    expect(carried.flatMap((override) => override.files)).not.toContain("**/specs/**/*.ts");
  });
});
