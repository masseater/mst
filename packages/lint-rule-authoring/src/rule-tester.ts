import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";

import type { WorkspaceLintRule } from "./create-workspace-lint-rule.ts";

/** @public */
export const testLintRule = (
  rule: WorkspaceLintRule,
  cases: Parameters<RuleTester["run"]>[2],
): void => {
  RuleTester.describe = describe;
  RuleTester.it = it;
  RuleTester.itOnly = it.only;
  new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } }).run(
    rule.name,
    rule,
    cases,
  );
};
