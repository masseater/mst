import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "oxlint";

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
import { noPromiseChain } from "../lint/oxlint/rules/no-promise-chain--use-async-await.ts";
import { noReassign } from "../lint/oxlint/rules/no-reassign--use-spread-or-iife.ts";
import { noStandaloneTsconfig } from "../lint/oxlint/rules/no-standalone-tsconfig--extend-shared-preset.ts";
import { noTautologicalAssertion } from "../lint/oxlint/rules/no-tautological-assertion--assert-on-a-computed-value.ts";
import { requireReExportOnlyFiles } from "../lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { noDuplicatedBody, noLocalFiniteValueSet, noStrictCanonicalLiteralUse } from "../plugin.ts";

const PLUGIN_NAME = "dont-review-it";

const MAX_LINES_PER_FILE = 400;

const TEST_FILES = ["**/*.test.ts", "**/*.test.tsx"];

const SHARED_TSCONFIG_PRESETS = [
  "dont-review-it/tsconfig/library.json",
  "dont-review-it/tsconfig/app.json",
];

export const oxlint = defineConfig({
  jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/dont-review-it/plugin" }],
  overrides: [
    {
      files: TEST_FILES,
      rules: {
        "max-lines-per-function": [
          LINT_SEVERITY.ERROR,
          { max: 320, skipBlankLines: true, skipComments: true },
        ],
        "max-statements": LINT_SEVERITY.OFF,
      },
    },
  ],
  rules: {
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
    [`${PLUGIN_NAME}/${noPromiseChain.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noReassign.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noStandaloneTsconfig.name}`]: [
      LINT_SEVERITY.ERROR,
      [...SHARED_TSCONFIG_PRESETS],
    ],
    [`${PLUGIN_NAME}/${noStrictCanonicalLiteralUse.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noTautologicalAssertion.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireReExportOnlyFiles.name}`]: LINT_SEVERITY.ERROR,
    complexity: [LINT_SEVERITY.ERROR, { max: 10 }],
    "max-classes-per-file": [LINT_SEVERITY.ERROR, { max: 1 }],
    "max-depth": [LINT_SEVERITY.ERROR, { max: 4 }],
    "max-nested-callbacks": [LINT_SEVERITY.ERROR, { max: 2 }],
    "max-statements": [LINT_SEVERITY.ERROR, { max: 10 }],
    "max-lines-per-function": [
      LINT_SEVERITY.ERROR,
      { max: 200, skipBlankLines: true, skipComments: true },
    ],
    "max-params": [LINT_SEVERITY.ERROR, { max: 4 }],
    "no-console": LINT_SEVERITY.ERROR,
    "no-duplicate-imports": LINT_SEVERITY.ERROR,
    "no-empty": LINT_SEVERITY.ERROR,
    "no-empty-function": LINT_SEVERITY.ERROR,
    "typescript/ban-ts-comment": LINT_SEVERITY.ERROR,
    "typescript/no-explicit-any": LINT_SEVERITY.ERROR,
    "typescript/no-unnecessary-type-conversion": LINT_SEVERITY.ERROR,
  },
});
