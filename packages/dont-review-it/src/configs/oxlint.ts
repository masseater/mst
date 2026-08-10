import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig, type OxlintConfig } from "oxlint";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../lint/oxlint/lib/forbidden-ambiguous-names.ts";
import { forbidNumberedSiblingFile } from "../lint/oxlint/rules/forbid-numbered-sibling-file--name-what-each-file-owns.ts";
import { forbidOversizedFile } from "../lint/oxlint/rules/forbid-oversized-file--split-by-responsibility.ts";
import { noAmbiguousVariableName } from "../lint/oxlint/rules/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noArrayMutation } from "../lint/oxlint/rules/no-array-mutation--derive-new-array.ts";
import { noDefaultExport } from "../lint/oxlint/rules/no-default-export--use-named-export.ts";
import { noDetachedRationale } from "../lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noDetachedTestFile } from "../lint/oxlint/rules/no-detached-test-file--move-beside-source.ts";
import { noDoubleTypeAssertion } from "../lint/oxlint/rules/no-double-type-assertion--declare-the-real-type.ts";
import { noExplanatoryComment } from "../lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noIdentityWrapper } from "../lint/oxlint/rules/no-identity-wrapper--call-the-target-directly.ts";
import { noLoggedAndContinuedFailure } from "../lint/oxlint/rules/no-logged-and-continued-failure--stop-or-recover.ts";
import { noMultiBindingDeclaration } from "../lint/oxlint/rules/no-multi-binding-declaration--declare-one-binding-per-statement.ts";
import { noPromiseChain } from "../lint/oxlint/rules/no-promise-chain--use-async-await.ts";
import { noReassign } from "../lint/oxlint/rules/no-reassign--use-spread-or-iife.ts";
import { noStandaloneTsconfig } from "../lint/oxlint/rules/no-standalone-tsconfig--extend-shared-preset.ts";
import { noTautologicalAssertion } from "../lint/oxlint/rules/no-tautological-assertion--assert-on-a-computed-value.ts";
import { noUnorderedImport } from "../lint/oxlint/rules/no-unordered-import--group-by-origin-then-sort-by-specifier.ts";
import { requireReExportOnlyFiles } from "../lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { noDuplicatedBody, noLocalFiniteValueSet, noStrictCanonicalLiteralUse } from "../plugin.ts";
import { UPSTREAM_PLUGINS, UPSTREAM_RULES, UPSTREAM_TEST_RULES } from "./upstream-rules.ts";

const PLUGIN_NAME = "dont-review-it";

const MAX_LINES_PER_FILE = 400;

const MAX_LINES_PER_FUNCTION = 200;

const SOURCE_FILES = ["**/*.ts", "**/*.tsx"];

const TEST_FILES = ["**/*.test.ts", "**/*.test.tsx"];

const SHARED_TSCONFIG_PRESETS = [
  "dont-review-it/tsconfig/library.json",
  "dont-review-it/tsconfig/app.json",
];

export const oxlint: OxlintConfig = defineConfig({
  categories: { correctness: LINT_SEVERITY.ERROR },
  plugins: [...UPSTREAM_PLUGINS],
  jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/dont-review-it/plugin" }],
  options: {
    reportUnusedDisableDirectives: LINT_SEVERITY.ERROR,
    respectEslintDisableDirectives: false,
  },
  overrides: [
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
    {
      files: TEST_FILES,
      rules: {
        ...UPSTREAM_TEST_RULES,
        "max-nested-callbacks": LINT_SEVERITY.OFF,
        "max-statements": LINT_SEVERITY.OFF,
      },
    },
  ],
  rules: {
    ...UPSTREAM_RULES,
    [`${PLUGIN_NAME}/${forbidNumberedSiblingFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${forbidOversizedFile.name}`]: [
      LINT_SEVERITY.ERROR,
      { maxLines: MAX_LINES_PER_FILE },
    ],
    [`${PLUGIN_NAME}/${noAmbiguousVariableName.name}`]: [
      LINT_SEVERITY.ERROR,
      [...FORBIDDEN_AMBIGUOUS_NAMES],
    ],
    [`${PLUGIN_NAME}/${noArrayMutation.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDefaultExport.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDetachedRationale.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDetachedTestFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDoubleTypeAssertion.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDuplicatedBody.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExplanatoryComment.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noIdentityWrapper.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLocalFiniteValueSet.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLoggedAndContinuedFailure.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noMultiBindingDeclaration.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noPromiseChain.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noReassign.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noStandaloneTsconfig.name}`]: [
      LINT_SEVERITY.ERROR,
      [...SHARED_TSCONFIG_PRESETS],
    ],
    [`${PLUGIN_NAME}/${noStrictCanonicalLiteralUse.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noTautologicalAssertion.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noUnorderedImport.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireReExportOnlyFiles.name}`]: LINT_SEVERITY.ERROR,
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
  },
});
