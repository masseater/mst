export type PresetAdoptionConfig = {
  readonly toolchainConfigFileName: string;
  readonly toolchainModuleSpecifier: string;
  readonly configFactoryExportName: string;
  readonly presetModuleSpecifier: string;
  readonly presetExportName: string;
  readonly lintWrapperExportName: string;
  readonly lintFieldName: string;
  readonly extendsFieldName: string;
  readonly rulesFieldName: string;
  readonly overridesFieldName: string;
  readonly filesFieldName: string;
  readonly excludeFilesFieldName: string;
  readonly presetRulePrefix: string;
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
  presetExportName: "oxlint",
  lintWrapperExportName: "withGitExcludes",
  lintFieldName: "lint",
  extendsFieldName: "extends",
  rulesFieldName: "rules",
  overridesFieldName: "overrides",
  filesFieldName: "files",
  excludeFilesFieldName: "excludeFiles",
  presetRulePrefix: "dont-review-it/",
  allowedDisabledRule: {
    ruleId: "dont-review-it/no-handmade-standard-io-double--use-standard-io-test",
    filePatterns: ["packages/ai-native/**", "packages/lint-rule-authoring/**"],
  },
};
