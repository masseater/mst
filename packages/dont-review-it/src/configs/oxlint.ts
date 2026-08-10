import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "oxlint";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../lint/oxlint/lib/forbidden-ambiguous-names.ts";
import { forbidOversizedFile } from "../lint/oxlint/rules/forbid-oversized-file--split-by-responsibility.ts";
import { noAmbiguousVariableName } from "../lint/oxlint/rules/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noArrayMutation } from "../lint/oxlint/rules/no-array-mutation--derive-new-array.ts";
import { noDefaultExport } from "../lint/oxlint/rules/no-default-export--use-named-export.ts";
import { noDetachedRationale } from "../lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noDetachedTestFile } from "../lint/oxlint/rules/no-detached-test-file--move-beside-source.ts";
import { noExplanatoryComment } from "../lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noPromiseChain } from "../lint/oxlint/rules/no-promise-chain--use-async-await.ts";
import { noReassign } from "../lint/oxlint/rules/no-reassign--use-spread-or-iife.ts";
import { requireReExportOnlyFiles } from "../lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { noLocalFiniteValueSet, noStrictCanonicalLiteralUse } from "../plugin.ts";

const PLUGIN_NAME = "dont-review-it";

const MAX_LINES_PER_FILE = 400;

const TOOL_REQUIRED_DEFAULT_EXPORT_FILES = ["**/plugin.ts", "**/vite.config.ts"];

export const oxlint = defineConfig({
  jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/dont-review-it/plugin" }],
  overrides: [
    {
      files: TOOL_REQUIRED_DEFAULT_EXPORT_FILES,
      rules: { [`${PLUGIN_NAME}/${noDefaultExport.name}`]: LINT_SEVERITY.OFF },
    },
  ],
  rules: {
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
    [`${PLUGIN_NAME}/${noExplanatoryComment.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLocalFiniteValueSet.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noPromiseChain.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noReassign.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noStrictCanonicalLiteralUse.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireReExportOnlyFiles.name}`]: LINT_SEVERITY.ERROR,
  },
});
