import { lintToolOf } from "../lint-tool.ts";
import { escapePipes, noticesOf } from "./rule-table.ts";

import type { LintRuleFacts } from "./rule-facts.ts";

const NOTICE_LEGEND =
  "補足の記号 — 🔧: 自動修正あり / 💡: エディタの修正候補あり / ⚙️: オプションあり";

const rowOf = (rule: LintRuleFacts): string =>
  `| [${rule.name}](./${rule.name}.md) | ${escapePipes(rule.description)} | ${lintToolOf(rule.sourcePath)} | ${noticesOf(rule)} |`;

const TABLE_HEAD = "| ルール | 説明 | ツール | 補足 |\n| --- | --- | --- | --- |";

const tableOf = (rules: readonly LintRuleFacts[]): string =>
  [TABLE_HEAD, ...rules.map(rowOf)].join("\n");

const SHIPPED_HEADING = "## 既定で配るルール";

const OPT_IN_HEADING = "## 名指しで有効にするルール";

const OPT_IN_NOTE =
  "このワークスペースが実装して配布するが、出荷する preset には載せていないルール。使う側が `rules` に名前を書いて初めて効く。載せていない理由は各ルールの文書が持つ。";

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
