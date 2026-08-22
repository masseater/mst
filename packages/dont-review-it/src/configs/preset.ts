import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { isEqual, omit, uniq, uniqBy } from "es-toolkit";

import { oxfmt } from "./oxfmt.ts";
import {
  PRESET_ALLOWED_DISABLED_RULE,
  PRESET_LINT_CONFIGS,
  PRESET_OWNED_ROOT_RULES,
  PRESET_OWNED_RULE_IDS,
} from "./preset-lint-configs.ts";
import { withGitExcludes } from "./with-git-excludes.ts";

import type { OxfmtConfig } from "oxfmt";
import type { ExternalPluginEntry, OxlintConfig, OxlintOverride } from "oxlint";

const presetPlugins = uniq(PRESET_LINT_CONFIGS.flatMap((config) => config.plugins ?? []));

const presetJsPlugins = PRESET_LINT_CONFIGS.flatMap((config) => config.jsPlugins ?? []);

const presetCategories = PRESET_LINT_CONFIGS.reduce<NonNullable<OxlintConfig["categories"]>>(
  (mergedCategories, presetConfig) => ({
    ...mergedCategories,
    ...presetConfig.categories,
  }),
  {},
);

const presetOptions = PRESET_LINT_CONFIGS.reduce<NonNullable<OxlintConfig["options"]>>(
  (mergedOptions, presetConfig) => ({
    ...mergedOptions,
    ...presetConfig.options,
  }),
  {},
);

const pluginNameOf = (plugin: ExternalPluginEntry): string =>
  typeof plugin === "string" ? plugin : plugin.name;

const ownValueAt = <Subject extends object, Key extends keyof Subject>(
  subject: Subject,
  propertyName: Key,
): Subject[Key] | undefined => {
  const descriptor = Object.getOwnPropertyDescriptor(subject, propertyName);
  return descriptor !== undefined && descriptor.get === undefined && descriptor.set === undefined
    ? subject[propertyName]
    : undefined;
};

const immutablePluginEntry = (plugin: ExternalPluginEntry): ExternalPluginEntry =>
  typeof plugin === "string"
    ? plugin
    : Object.freeze({ name: plugin.name, specifier: plugin.specifier });

const protectedJsPlugins = (
  configured: OxlintConfig["jsPlugins"],
): readonly ExternalPluginEntry[] => {
  if (configured?.some((plugin) => typeof plugin === "string") === true) {
    throw new TypeError(
      "dontReviewItPreset.lint requires caller jsPlugins to use explicit name and specifier objects.",
    );
  }
  return uniqBy(
    [...(configured ?? []).map(immutablePluginEntry), ...presetJsPlugins].toReversed(),
    pluginNameOf,
  ).toReversed();
};

const protectedRootRules = (
  configured: OxlintConfig["rules"],
): NonNullable<OxlintConfig["rules"]> => ({
  ...omit(configured ?? {}, PRESET_OWNED_RULE_IDS),
  ...PRESET_OWNED_ROOT_RULES,
});

const isUnknownArray = (candidate: unknown): candidate is readonly unknown[] =>
  Array.isArray(candidate);

const isDisabledSeverity = (configuredRule: unknown): boolean => {
  const severity = isUnknownArray(configuredRule) ? configuredRule[0] : configuredRule;
  return severity === 0 || severity === "allow" || severity === LINT_SEVERITY.OFF;
};

const allowedOverrideRule = (override: OxlintOverride): OxlintConfig["rules"] => {
  const configuredRule = ownValueAt(override, "rules")?.[PRESET_ALLOWED_DISABLED_RULE.ruleId];
  const files = ownValueAt(override, "files");
  return configuredRule !== undefined &&
    isDisabledSeverity(configuredRule) &&
    files !== undefined &&
    isEqual(files.toSorted(), PRESET_ALLOWED_DISABLED_RULE.filePatterns.toSorted()) &&
    (ownValueAt(override, "excludeFiles")?.length ?? 0) === 0
    ? { [PRESET_ALLOWED_DISABLED_RULE.ruleId]: configuredRule }
    : {};
};

const protectedOverride = (override: OxlintOverride): OxlintOverride => ({
  env: ownValueAt(override, "env"),
  excludeFiles: ownValueAt(override, "excludeFiles"),
  files: ownValueAt(override, "files") ?? [],
  globals: ownValueAt(override, "globals"),
  plugins: uniq([...(ownValueAt(override, "plugins") ?? []), ...presetPlugins]),
  jsPlugins: [...protectedJsPlugins(ownValueAt(override, "jsPlugins"))],
  rules: {
    ...omit(ownValueAt(override, "rules") ?? {}, PRESET_OWNED_RULE_IDS),
    ...allowedOverrideRule(override),
  },
});

const protectedLintConfig = (config: OxlintConfig): OxlintConfig => ({
  categories: { ...ownValueAt(config, "categories"), ...presetCategories },
  extends: [...PRESET_LINT_CONFIGS],
  env: ownValueAt(config, "env"),
  globals: ownValueAt(config, "globals"),
  ignorePatterns: ownValueAt(config, "ignorePatterns"),
  jsPlugins: [...protectedJsPlugins(ownValueAt(config, "jsPlugins"))],
  options: {
    ...ownValueAt(config, "options"),
    ...presetOptions,
    typeAware: true,
    typeCheck: true,
  },
  overrides: ownValueAt(config, "overrides")?.map(protectedOverride),
  plugins: uniq([...(ownValueAt(config, "plugins") ?? []), ...presetPlugins]),
  rules: protectedRootRules(ownValueAt(config, "rules")),
  settings: ownValueAt(config, "settings"),
});

/** @public */
export const dontReviewItPreset = Object.freeze({
  fmt: (config: OxfmtConfig = {}): OxfmtConfig => withGitExcludes({ ...oxfmt, ...config }),
  lint: (config: OxlintConfig = {}): OxlintConfig => {
    if (ownValueAt(config, "extends") !== undefined) {
      throw new TypeError(
        "dontReviewItPreset.lint does not accept caller extends; pass additions directly.",
      );
    }
    return withGitExcludes(protectedLintConfig(config));
  },
});
