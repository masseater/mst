import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig } from "oxlint";

import { noDetachedRationale } from "../lint/oxlint/rules/no-detached-rationale--comment-at-explained-line.ts";
import { noExplanatoryComment } from "../lint/oxlint/rules/no-explanatory-comment--delete-or-move-to-commit-message.ts";

const PLUGIN_NAME = "dont-review-it";

export const oxlint = defineConfig({
  jsPlugins: [{ name: PLUGIN_NAME, specifier: "@mst/dont-review-it/plugin" }],
  rules: {
    [`${PLUGIN_NAME}/${noDetachedRationale.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noExplanatoryComment.name}`]: LINT_SEVERITY.ERROR,
  },
});
