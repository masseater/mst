import { workspaceLintRuleDocsUrl } from "../workspace-lint-rule-docs-path.ts";
import { bundleNamesIn, type BundledLintRule } from "./rule-bundle.ts";
import { escapePipes, noticesOf } from "./rule-table.ts";

const NOTICE_LEGEND =
  "Notices — 🔧: fixes itself / 💡: offers an editor suggestion / ⚙️: reads options";

const BUNDLES_HEADING = "## Bundles the preset can carry";

const BUNDLES_NOTE =
  "Each bundle is adopted on its own, and a rule sits in exactly one of them. Name the ones this repository takes on where it calls the preset.";

const ENABLED_HEADING = "## Rules the shipped preset enables";

const OPT_IN_HEADING = "## Rules this package ships without enabling them";

const OPT_IN_NOTE =
  "Whether these hold depends on the adopting repository, so the preset leaves them off. Name one in `rules` to turn it on; its document says why it is not enabled by default.";

const TABLE_HEAD = "| Rule | What it rejects | Notices |\n| --- | --- | --- |";

const rowOf = ({
  rule,
  workspaceDir,
}: {
  readonly rule: BundledLintRule;
  readonly workspaceDir: string;
}): string =>
  `| [${rule.name}](${workspaceLintRuleDocsUrl({ workspaceDir, ruleName: rule.name })}) | ${escapePipes(rule.description)} | ${noticesOf(rule)} |`;

const tableOf = ({
  rules,
  workspaceDir,
}: {
  readonly rules: readonly BundledLintRule[];
  readonly workspaceDir: string;
}): string => [TABLE_HEAD, ...rules.map((rule) => rowOf({ rule, workspaceDir }))].join("\n");

const bundleSectionsOf = ({
  rules,
  workspaceDir,
}: {
  readonly rules: readonly BundledLintRule[];
  readonly workspaceDir: string;
}): readonly string[] =>
  bundleNamesIn(rules).flatMap((bundle) => [
    `### ${bundle}`,
    "",
    tableOf({ rules: rules.filter((rule) => rule.bundle === bundle), workspaceDir }),
    "",
  ]);

const sectionsOf = ({
  rules,
  workspaceDir,
}: {
  readonly rules: readonly BundledLintRule[];
  readonly workspaceDir: string;
}): readonly string[] => {
  const optIn = rules.filter((rule) => !rule.shipped);
  const shipped = rules.filter((rule) => rule.shipped);
  const bundled = shipped.filter((rule) => rule.bundle !== null);
  const unbundled = shipped.filter((rule) => rule.bundle === null);
  if (bundled.length === 0 && optIn.length === 0)
    return [tableOf({ rules: unbundled, workspaceDir })];

  return [
    ...(bundled.length === 0 ? [] : [BUNDLES_HEADING, "", BUNDLES_NOTE, ""]),
    ...bundleSectionsOf({ rules: bundled, workspaceDir }),
    ...(unbundled.length === 0
      ? []
      : [ENABLED_HEADING, "", tableOf({ rules: unbundled, workspaceDir }), ""]),
    ...(optIn.length === 0
      ? []
      : [OPT_IN_HEADING, "", OPT_IN_NOTE, "", tableOf({ rules: optIn, workspaceDir }), ""]),
  ];
};

export const renderShippedRuleReference = ({
  rules,
  workspaceDir,
}: {
  readonly rules: readonly BundledLintRule[];
  readonly workspaceDir: string;
}): string => {
  const sortedOnes = rules.toSorted((left, right) => left.name.localeCompare(right.name));
  const rendered = sectionsOf({ rules: sortedOnes, workspaceDir }).join("\n").trimEnd();
  return sortedOnes.some((rule) => noticesOf(rule) !== "")
    ? `${rendered}\n\n${NOTICE_LEGEND}`
    : rendered;
};
