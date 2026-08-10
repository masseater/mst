import { forbidSymbolPrefixedName } from "./lint/oxlint/rules/forbid-symbol-prefixed-name--rename-to-alphanumeric-start.ts";
import { noBroadLintDisable } from "./lint/oxlint/rules/no-broad-lint-disable--use-next-line-with-reason.ts";

import type { Plugin } from "@oxlint/plugins";

const plugin: Plugin = {
  meta: { name: "lint-rule-authoring" },
  rules: {
    [forbidSymbolPrefixedName.name]: forbidSymbolPrefixedName,
    [noBroadLintDisable.name]: noBroadLintDisable,
  },
};

export default plugin;
