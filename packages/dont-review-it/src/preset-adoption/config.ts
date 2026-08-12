export type PresetAdoptionConfig = {
  readonly toolchainConfigFileName: string;
  readonly lintFieldName: string;
  readonly rulesFieldName: string;
  readonly overridesFieldName: string;
  readonly filesFieldName: string;
  readonly presetRulePrefix: string;
};

export const defaultPresetAdoptionConfig: PresetAdoptionConfig = {
  toolchainConfigFileName: "vite.config.ts",
  lintFieldName: "lint",
  rulesFieldName: "rules",
  overridesFieldName: "overrides",
  filesFieldName: "files",
  presetRulePrefix: "dont-review-it/",
};
