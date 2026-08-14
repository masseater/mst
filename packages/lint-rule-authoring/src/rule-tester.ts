import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vite-plus/test";

import type { WorkspaceLintRule } from "./create-workspace-lint-rule.ts";

type TesterCases = Parameters<RuleTester["run"]>[2];

type Documented = { readonly documented?: boolean };

/** @public */
export const testLintRule = (
  rule: WorkspaceLintRule,
  cases: {
    readonly valid: readonly (Extract<TesterCases["valid"][number], object> & Documented)[];
    readonly invalid: readonly (TesterCases["invalid"][number] & Documented)[];
  },
): void => {
  RuleTester.describe = describe;
  RuleTester.it = it;
  RuleTester.itOnly = it.only;
  new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } }).run(rule.name, rule, {
    valid: [...cases.valid],
    invalid: [...cases.invalid],
  });
};
