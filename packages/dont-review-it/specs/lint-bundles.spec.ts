import { describe, expect, it } from "vite-plus/test";

import { LINT_BUNDLE, type LintBundleSelection } from "../src/configs/bundles/bundle-names.ts";
import { dontReviewItPreset } from "../src/index.ts";

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

  it("テストの束を採らないと、仕様担保テストの置き場に与える設定も入らない", () => {
    const withoutTesting = dontReviewItPreset.lint({ bundles: [LINT_BUNDLE.writing] });
    const carried = (withoutTesting.extends ?? [])
      .filter((extended) => typeof extended !== "string")
      .flatMap((extended) => extended.overrides ?? []);

    expect(carried.flatMap((override) => override.files)).not.toContain("**/specs/**/*.ts");
  });
});
