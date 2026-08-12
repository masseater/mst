import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { defineConfig, type OxlintConfig } from "oxlint";

import { noCittyParentRun } from "../lint/oxlint/rules/no-citty-parent-run--move-run-into-a-subcommand.ts";
import { noHandmadeStandardIoDouble } from "../lint/oxlint/rules/no-handmade-standard-io-double--use-standard-io-test.ts";
import { requireStandardIoSnapshot } from "../lint/oxlint/rules/require-standard-io-snapshot--pin-both-streams.ts";
import { oxlint, PLUGIN_NAME } from "./oxlint.ts";

/** @public */
export const oxlintCli: OxlintConfig = defineConfig({
  ...oxlint,
  rules: {
    ...oxlint.rules,
    [`${PLUGIN_NAME}/${noCittyParentRun.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${noHandmadeStandardIoDouble.name}`]: LINT_SEVERITY.ERROR,
    [`${PLUGIN_NAME}/${requireStandardIoSnapshot.name}`]: LINT_SEVERITY.ERROR,
  },
});
