import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "oxlint";

import { FORBIDDEN_AMBIGUOUS_NAMES } from "../lint/oxlint/lib/forbidden-ambiguous-names.ts";
import { forbidOversizedFile } from "../lint/oxlint/rules/forbid-oversized-file--split-by-responsibility.ts";
import { noAmbiguousVariableName } from "../lint/oxlint/rules/no-ambiguous-variable-name--rename-to-concrete-noun.ts";
import { noDefaultExport } from "../lint/oxlint/rules/no-default-export--use-named-export.ts";
import { noDetachedRationale } from "../lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noDetachedTestFile } from "../lint/oxlint/rules/no-detached-test-file--move-beside-source.ts";
import { noExplanatoryComment } from "../lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";
import { noStandaloneTsconfig } from "../lint/oxlint/rules/no-standalone-tsconfig--extend-shared-preset.ts";
import { requireReExportOnlyFiles } from "../lint/oxlint/rules/require-re-export-only-files--move-declaration-to-owning-module.ts";
import { noLocalFiniteValueSet, noStrictCanonicalLiteralUse } from "../plugin.ts";

const PLUGIN_NAME = "dont-review-it";

const MAX_LINES_PER_FILE = 500;

const SHARED_TSCONFIG_PRESETS = [
  "dont-review-it/tsconfig/library.json",
  "dont-review-it/tsconfig/app.json",
];

export const oxlint = defineConfig({
  jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/dont-review-it/plugin" }],
  rules: {
    [`${PLUGIN_NAME}/${forbidOversizedFile.name}`]: [
      LINT_SEVERITY.ERROR,
      { maxLines: MAX_LINES_PER_FILE },
    ],
    [`${PLUGIN_NAME}/${noAmbiguousVariableName.name}`]: [
      LINT_SEVERITY.ERROR,
      [...FORBIDDEN_AMBIGUOUS_NAMES],
    ],
    [`${PLUGIN_NAME}/${noDefaultExport.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDetachedRationale.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noDetachedTestFile.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExplanatoryComment.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noLocalFiniteValueSet.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noStandaloneTsconfig.name}`]: [
      LINT_SEVERITY.ERROR,
      [...SHARED_TSCONFIG_PRESETS],
    ],
    [`${PLUGIN_NAME}/${noStrictCanonicalLiteralUse.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireReExportOnlyFiles.name}`]: LINT_SEVERITY.ERROR,
  },
});
