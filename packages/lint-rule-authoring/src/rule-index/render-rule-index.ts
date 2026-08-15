import { lintToolOf } from "../lint-tool.ts";
import { bundleNamesIn, type BundledLintRule } from "./rule-bundle.ts";
import { escapePipes, noticesOf } from "./rule-table.ts";

const NOTICE_LEGEND = "Notices — 🔧: fixable / 💡: suggestions / ⚙️: options";

const BUNDLES_HEADING = "## Bundles";

const BUNDLES_NOTE =
  "Each bundle is adopted on its own, and a rule sits in exactly one of them. Which bundles a repository takes on is written where it calls the preset.";

const SHIPPED_HEADING = "## Shipped in the preset";

const OPT_IN_HEADING = "## Enabled by name";

const OPT_IN_NOTE =
  "Rules this workspace ships without putting them in the preset. A consumer names one in `rules` to turn it on. Why a rule is left out is written in its own document.";

const TABLE_HEAD = "| Rule | Description | Tool | Notices |\n| --- | --- | --- | --- |";

const rowOf = (rule: BundledLintRule): string =>
  `| [${rule.name}](./${rule.name}.md) | ${escapePipes(rule.description)} | ${lintToolOf(rule.sourcePath)} | ${noticesOf(rule)} |`;

const tableOf = (rules: readonly BundledLintRule[]): string =>
  [TABLE_HEAD, ...rules.map(rowOf)].join("\n");

const bundleSectionsOf = (rules: readonly BundledLintRule[]): readonly string[] =>
  bundleNamesIn(rules).flatMap((bundle) => [
    `### ${bundle}`,
    "",
    tableOf(rules.filter((rule) => rule.bundle === bundle)),
    "",
  ]);

const sectionsOf = ({
  bundled,
  unbundled,
  optIn,
}: {
  readonly bundled: readonly BundledLintRule[];
  readonly unbundled: readonly BundledLintRule[];
  readonly optIn: readonly BundledLintRule[];
}): readonly string[] => [
  ...(bundled.length === 0 ? [] : [BUNDLES_HEADING, "", BUNDLES_NOTE, ""]),
  ...bundleSectionsOf(bundled),
  ...(unbundled.length === 0 ? [] : [SHIPPED_HEADING, "", tableOf(unbundled), ""]),
  ...(optIn.length === 0 ? [] : [OPT_IN_HEADING, "", OPT_IN_NOTE, "", tableOf(optIn), ""]),
];

export const renderRuleIndex = (rules: readonly BundledLintRule[]): string => {
  const sortedOnes = rules.toSorted((left, right) => left.name.localeCompare(right.name));
  const optIn = sortedOnes.filter((rule) => !rule.shipped);
  const shipped = sortedOnes.filter((rule) => rule.shipped);
  const bundled = shipped.filter((rule) => rule.bundle !== null);
  const unbundled = shipped.filter((rule) => rule.bundle === null);
  const renderedTables =
    bundled.length === 0 && optIn.length === 0
      ? tableOf(unbundled)
      : sectionsOf({ bundled, unbundled, optIn }).join("\n").trimEnd();
  return sortedOnes.some((rule) => noticesOf(rule) !== "")
    ? `${renderedTables}\n\n${NOTICE_LEGEND}`
    : renderedTables;
};
