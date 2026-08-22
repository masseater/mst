import { freezeDeep, oxlint as lintRuleAuthoringOxlint } from "@mst/lint-rule-authoring";
import { oxlint as verifiedSpecificationsOxlint } from "@mst/verified-specifications";
import { cloneDeep, uniq } from "es-toolkit";

import { oxlint } from "./oxlint.ts";

import type { OxlintConfig } from "oxlint";

export const PRESET_LINT_CONFIGS: readonly OxlintConfig[] = [
  lintRuleAuthoringOxlint,
  oxlint,
  verifiedSpecificationsOxlint,
].map((config) => cloneDeep(config));

freezeDeep(PRESET_LINT_CONFIGS);

export const PRESET_RULE_PLUGIN_NAMES: readonly string[] = uniq(
  PRESET_LINT_CONFIGS.flatMap((config) => config.jsPlugins ?? []).map((plugin) =>
    typeof plugin === "string" ? plugin : plugin.name,
  ),
);

freezeDeep(PRESET_RULE_PLUGIN_NAMES);

const configuredRuleIds = PRESET_LINT_CONFIGS.flatMap((config) => [
  ...Object.keys(config.rules ?? {}),
  ...(config.overrides ?? []).flatMap((override) => Object.keys(override.rules ?? {})),
]);

export const PRESET_OWNED_RULE_IDS: readonly string[] = uniq(configuredRuleIds).toSorted();

freezeDeep(PRESET_OWNED_RULE_IDS);

export const PRESET_OWNED_ROOT_RULES = PRESET_LINT_CONFIGS.reduce<
  NonNullable<OxlintConfig["rules"]>
>(
  (ownedRules, config) => ({
    ...ownedRules,
    ...config.rules,
  }),
  {},
);

freezeDeep(PRESET_OWNED_ROOT_RULES);

export const PRESET_ALLOWED_DISABLED_RULE = {
  ruleId: "dont-review-it/no-handmade-standard-io-double--use-standard-io-test",
  filePatterns: [
    "packages/ai-native/**",
    "packages/lint-rule-authoring/**",
    "packages/verified-specifications/**",
  ],
};

freezeDeep(PRESET_ALLOWED_DISABLED_RULE);
