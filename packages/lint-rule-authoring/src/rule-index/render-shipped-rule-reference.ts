import { workspaceLintRuleDocsUrl } from "../workspace-lint-rule-docs-path.ts";
import { escapePipes, noticesOf } from "./rule-table.ts";

import type { LintRuleFacts } from "./rule-facts.ts";

const NOTICE_LEGEND =
  "Notices — 🔧: fixes itself / 💡: offers an editor suggestion / ⚙️: reads options";

const rowOf = ({
  rule,
  workspaceDir,
}: {
  readonly rule: LintRuleFacts;
  readonly workspaceDir: string;
}): string =>
  `| [${rule.name}](${workspaceLintRuleDocsUrl({ workspaceDir, ruleName: rule.name })}) | ${escapePipes(rule.description)} | ${noticesOf(rule)} |`;

const TABLE_HEAD = "| Rule | What it rejects | Notices |\n| --- | --- | --- |";

const tableOf = ({
  rules,
  workspaceDir,
}: {
  readonly rules: readonly LintRuleFacts[];
  readonly workspaceDir: string;
}): string => [TABLE_HEAD, ...rules.map((rule) => rowOf({ rule, workspaceDir }))].join("\n");

const ENABLED_HEADING = "## Rules the shipped preset enables";

const OPT_IN_HEADING = "## Rules this package ships without enabling them";

const OPT_IN_NOTE =
  "Whether these hold depends on the adopting repository, so the preset leaves them off. Name one in `rules` to turn it on; its document says why it is not enabled by default.";

const sectionsOf = ({
  enabled,
  optIn,
  workspaceDir,
}: {
  readonly enabled: readonly LintRuleFacts[];
  readonly optIn: readonly LintRuleFacts[];
  readonly workspaceDir: string;
}): readonly string[] =>
  optIn.length === 0
    ? [tableOf({ rules: enabled, workspaceDir })]
    : [
        ENABLED_HEADING,
        "",
        tableOf({ rules: enabled, workspaceDir }),
        "",
        OPT_IN_HEADING,
        "",
        OPT_IN_NOTE,
        "",
        tableOf({ rules: optIn, workspaceDir }),
      ];

export const renderShippedRuleReference = ({
  rules,
  workspaceDir,
}: {
  readonly rules: readonly LintRuleFacts[];
  readonly workspaceDir: string;
}): string => {
  const sortedOnes = rules.toSorted((left, right) => left.name.localeCompare(right.name));
  const rendered = sectionsOf({
    enabled: sortedOnes.filter((rule) => rule.shipped),
    optIn: sortedOnes.filter((rule) => !rule.shipped),
    workspaceDir,
  }).join("\n");
  return sortedOnes.some((rule) => noticesOf(rule) !== "")
    ? `${rendered}\n\n${NOTICE_LEGEND}`
    : rendered;
};
