import { lintToolOf } from "../lint-tool.ts";
import { escapePipes, noticesOf } from "./rule-table.ts";

import type { LintRuleFacts } from "./rule-facts.ts";

const NOTICE_LEGEND = "Notices — 🔧: fixable / 💡: suggestions / ⚙️: options";

const rowOf = (rule: LintRuleFacts): string =>
  `| [${rule.name}](./${rule.name}.md) | ${escapePipes(rule.description)} | ${lintToolOf(rule.sourcePath)} | ${noticesOf(rule)} |`;

const TABLE_HEAD = "| Rule | Description | Tool | Notices |\n| --- | --- | --- | --- |";

const tableOf = (rules: readonly LintRuleFacts[]): string =>
  [TABLE_HEAD, ...rules.map(rowOf)].join("\n");

const SHIPPED_HEADING = "## Shipped in the preset";

const OPT_IN_HEADING = "## Enabled by name";

const OPT_IN_NOTE =
  "Rules this workspace ships without putting them in the preset. A consumer names one in `rules` to turn it on. Why a rule is left out is written in its own document.";

const splitTablesOf = ({
  shipped,
  optIn,
}: {
  readonly shipped: readonly LintRuleFacts[];
  readonly optIn: readonly LintRuleFacts[];
}): string =>
  [
    SHIPPED_HEADING,
    "",
    tableOf(shipped),
    "",
    OPT_IN_HEADING,
    "",
    OPT_IN_NOTE,
    "",
    tableOf(optIn),
  ].join("\n");

export const renderRuleIndex = (rules: readonly LintRuleFacts[]): string => {
  const sortedOnes = rules.toSorted((left, right) => left.name.localeCompare(right.name));
  const optIn = sortedOnes.filter((rule) => !rule.shipped);
  const renderedTables =
    optIn.length === 0
      ? tableOf(sortedOnes)
      : splitTablesOf({ shipped: sortedOnes.filter((rule) => rule.shipped), optIn });
  return sortedOnes.some((rule) => noticesOf(rule) !== "")
    ? `${renderedTables}\n\n${NOTICE_LEGEND}`
    : renderedTables;
};
