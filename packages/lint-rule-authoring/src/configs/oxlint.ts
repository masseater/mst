import { defineConfig } from "oxlint";

import { LINT_SEVERITY } from "../lint-rule-severity.ts";
import { forbidSymbolPrefixedName } from "../lint/oxlint/rules/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts";
import { noBroadLintDisable } from "../lint/oxlint/rules/no-broad-lint-disable--use-next-line-with-reason.ts";
import { noExplainedLintMessage } from "../lint/oxlint/rules/no-explained-lint-message--state-prohibition-then-fix.ts";

const PLUGIN_NAME = "lint-rule-authoring";

/** @public */
export const oxlint = defineConfig({
  jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/lint-rule-authoring/plugin" }],
  rules: {
    [`${PLUGIN_NAME}/${forbidSymbolPrefixedName.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noBroadLintDisable.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExplainedLintMessage.name}`]: LINT_SEVERITY.ERROR,
  },
});
