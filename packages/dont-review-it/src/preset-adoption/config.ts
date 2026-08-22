import {
  PRESET_ALLOWED_DISABLED_RULE,
  PRESET_OWNED_RULE_IDS,
  PRESET_RULE_PLUGIN_NAMES,
} from "../configs/preset-lint-configs.ts";

export type PresetAdoptionConfig = {
  readonly toolchainConfigFileName: string;
  readonly toolchainModuleSpecifier: string;
  readonly configFactoryExportName: string;
  readonly presetModuleSpecifier: string;
  readonly presetExportName: string;
  readonly presetLintFunctionName: string;
  readonly severityModuleSpecifier: string;
  readonly severityExportName: string;
  readonly lintFieldName: string;
  readonly extendsFieldName: string;
  readonly ignorePatternsFieldName: string;
  readonly rulesFieldName: string;
  readonly overridesFieldName: string;
  readonly filesFieldName: string;
  readonly excludeFilesFieldName: string;
  readonly presetRulePluginNames: readonly string[];
  readonly inlineSuppressionGuardRuleName: string;
  readonly presetOwnedRuleIds: readonly string[];
  readonly allowedDisabledRule: {
    readonly ruleId: string;
    readonly filePatterns: readonly string[];
  };
};

export const defaultPresetAdoptionConfig: PresetAdoptionConfig = {
  toolchainConfigFileName: "vite.config.ts",
  toolchainModuleSpecifier: "vite-plus",
  configFactoryExportName: "defineConfig",
  presetModuleSpecifier: "@mst/dont-review-it",
  presetExportName: "dontReviewItPreset",
  presetLintFunctionName: "lint",
  severityModuleSpecifier: "@mst/lint-rule-authoring",
  severityExportName: "LINT_SEVERITY",
  lintFieldName: "lint",
  extendsFieldName: "extends",
  ignorePatternsFieldName: "ignorePatterns",
  rulesFieldName: "rules",
  overridesFieldName: "overrides",
  filesFieldName: "files",
  excludeFilesFieldName: "excludeFiles",
  presetRulePluginNames: PRESET_RULE_PLUGIN_NAMES,
  inlineSuppressionGuardRuleName:
    "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration",
  presetOwnedRuleIds: PRESET_OWNED_RULE_IDS,
  allowedDisabledRule: PRESET_ALLOWED_DISABLED_RULE,
};
