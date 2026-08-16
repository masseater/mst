import { LINT_SEVERITY, type WorkspaceLintRule } from "@mst/lint-rule-authoring";
import { defineConfig, type OxlintConfig } from "oxlint";

import { noUnregisteredRulePlugin } from "../lint/oxlint/rules/governance/no-unregistered-rule-plugin--enable-the-plugin.ts";
import { noStandaloneTsconfig } from "../lint/oxlint/rules/toolchain/no-standalone-tsconfig--extend-shared-preset.ts";
import { requireReExportOnlyFiles } from "../lint/oxlint/rules/writing/require-re-export-only-files--move-declaration-to-owning-module.ts";
import {
  LINT_BUNDLE,
  selectedLintBundles,
  type LintBundle,
  type LintBundleSelection,
} from "./bundles/bundle-names.ts";
import { governanceBundle } from "./bundles/governance.ts";
import { mutationAndFailureBundle } from "./bundles/mutation-and-failure.ts";
import { singleOwnershipBundle } from "./bundles/single-ownership.ts";
import { testingBundle } from "./bundles/testing.ts";
import { toolchainBundle } from "./bundles/toolchain.ts";
import { writingBundle } from "./bundles/writing.ts";
import { specDirectoryOverrides } from "./spec-directory-overrides.ts";
import { UPSTREAM_PLUGINS, UPSTREAM_RULES, UPSTREAM_TEST_RULES } from "./upstream-rules.ts";

export const BUNDLE_RULES = {
  governance: governanceBundle,
  writing: writingBundle,
  testing: testingBundle,
  "single-ownership": singleOwnershipBundle,
  "mutation-and-failure": mutationAndFailureBundle,
  toolchain: toolchainBundle,
  publishing: [],
  ci: [],
} as const satisfies Record<LintBundle, readonly WorkspaceLintRule[]>;

type RuleSetting = NonNullable<OxlintConfig["rules"]>[string];

const SHARED_TSCONFIG_PRESETS = [
  "dont-review-it/tsconfig/library.json",
  "dont-review-it/tsconfig/app.json",
];

const RE_EXPORT_ONLY_FILES = ["**/index.ts", "**/index.tsx"];

const PLUGIN_NAME = "dont-review-it";

const CONFIGURED_RULES: ReadonlyMap<string, RuleSetting> = new Map<string, RuleSetting>([
  [noStandaloneTsconfig.name, [LINT_SEVERITY.ERROR, [...SHARED_TSCONFIG_PRESETS]]],
  [requireReExportOnlyFiles.name, [LINT_SEVERITY.ERROR, { targets: [...RE_EXPORT_ONLY_FILES] }]],
  [
    noUnregisteredRulePlugin.name,
    [LINT_SEVERITY.ERROR, { plugins: [...UPSTREAM_PLUGINS, PLUGIN_NAME] }],
  ],
]);

const ruleEntriesOf = (bundles: readonly LintBundle[]): NonNullable<OxlintConfig["rules"]> =>
  Object.fromEntries(
    bundles
      .flatMap((bundle) => BUNDLE_RULES[bundle])
      .map((rule) => [
        `${PLUGIN_NAME}/${rule.name}`,
        CONFIGURED_RULES.get(rule.name) ?? LINT_SEVERITY.ERROR,
      ]),
  );

const MAX_LINES_PER_FUNCTION = 200;

const SOURCE_FILES = ["**/*.ts", "**/*.tsx"];

const TEST_FILES = ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"];

const WRITING_OVERRIDES: NonNullable<OxlintConfig["overrides"]> = [
  {
    files: SOURCE_FILES,
    excludeFiles: TEST_FILES,
    rules: {
      "max-lines-per-function": [
        LINT_SEVERITY.ERROR,
        { max: MAX_LINES_PER_FUNCTION, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];

const TESTING_OVERRIDES: NonNullable<OxlintConfig["overrides"]> = [
  {
    files: TEST_FILES,
    rules: {
      ...UPSTREAM_TEST_RULES,
      "max-nested-callbacks": LINT_SEVERITY.OFF,
      "max-statements": LINT_SEVERITY.OFF,
    },
  },
  ...specDirectoryOverrides,
];

const WRITING_RULES: NonNullable<OxlintConfig["rules"]> = {
  ...UPSTREAM_RULES,
  complexity: [LINT_SEVERITY.ERROR, { max: 10 }],
  "max-classes-per-file": [LINT_SEVERITY.ERROR, { max: 1 }],
  "max-depth": [LINT_SEVERITY.ERROR, { max: 4 }],
  "max-nested-callbacks": [LINT_SEVERITY.ERROR, { max: 2 }],
  "max-params": [LINT_SEVERITY.ERROR, { max: 2 }],
  "max-statements": [LINT_SEVERITY.ERROR, { max: 10 }],
  "no-console": LINT_SEVERITY.ERROR,
  "no-duplicate-imports": LINT_SEVERITY.ERROR,
  "no-empty": LINT_SEVERITY.ERROR,
  "no-empty-function": LINT_SEVERITY.ERROR,
  "typescript/ban-ts-comment": LINT_SEVERITY.ERROR,
  "typescript/no-explicit-any": LINT_SEVERITY.ERROR,
  "typescript/no-unnecessary-type-conversion": LINT_SEVERITY.ERROR,
};

export const oxlintFor = (selection: LintBundleSelection): OxlintConfig => {
  const bundles = selectedLintBundles(selection);
  const carriesWriting = bundles.includes(LINT_BUNDLE.writing);
  const carriesTesting = bundles.includes(LINT_BUNDLE.testing);

  return defineConfig({
    categories: { correctness: LINT_SEVERITY.ERROR },
    plugins: [...UPSTREAM_PLUGINS],
    jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/dont-review-it/plugin" }],
    options: {
      reportUnusedDisableDirectives: LINT_SEVERITY.ERROR,
      respectEslintDisableDirectives: false,
    },
    overrides: [
      ...(carriesWriting ? WRITING_OVERRIDES : []),
      ...(carriesTesting ? TESTING_OVERRIDES : []),
    ],
    rules: {
      ...(carriesWriting ? WRITING_RULES : {}),
      ...ruleEntriesOf(bundles),
    },
  });
};
