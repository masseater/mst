import type { LintRuleFacts } from "./rule-facts.ts";

const TABLE_HEAD = "| ルール | 説明 | ツール | 補足 |\n| --- | --- | --- | --- |";

const NOTICE_LEGEND =
  "補足の記号 — 🔧: 自動修正あり / 💡: エディタの修正候補あり / ⚙️: オプションあり";

const toolOf = (sourcePath: string): string => {
  const segments = sourcePath.split("/");
  const lintSegmentAt = segments.indexOf("lint");
  if (lintSegmentAt === -1) return "-";
  return segments[lintSegmentAt + 1] ?? "-";
};

const noticesOf = (rule: LintRuleFacts): string =>
  [rule.fixable ? "🔧" : "", rule.hasSuggestions ? "💡" : "", rule.configurable ? "⚙️" : ""]
    .filter((symbol) => symbol !== "")
    .join(" ");

const escapePipes = (writtenText: string): string => writtenText.replaceAll("|", String.raw`\|`);

const rowOf = (rule: LintRuleFacts): string =>
  `| [${rule.name}](./${rule.name}.md) | ${escapePipes(rule.description)} | ${toolOf(rule.sourcePath)} | ${noticesOf(rule)} |`;

export const renderRuleIndex = (rules: readonly LintRuleFacts[]): string => {
  const sortedOnes = rules.toSorted((left, right) => left.name.localeCompare(right.name));
  const table = [TABLE_HEAD, ...sortedOnes.map(rowOf)].join("\n");
  return sortedOnes.some((rule) => noticesOf(rule) !== "") ? `${table}\n\n${NOTICE_LEGEND}` : table;
};
