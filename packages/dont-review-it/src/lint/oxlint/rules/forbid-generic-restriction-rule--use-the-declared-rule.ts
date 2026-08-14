import { LINT_SEVERITY } from "@mst/lint-rule-authoring";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { listedUnder } from "../lib/declared-replacements/option-lists.ts";
import { bareRuleNameOf } from "../lib/lint-suppression/suppression-directives.ts";
import { propertyKeyOf } from "../lib/object-literal.ts";
import { spelledSeverityOf } from "../lib/spelled-lint-severity.ts";

import type { ESTree, Options } from "@oxlint/plugins";
import type { RuleMessage } from "../lib/rule-message.ts";

const ENTRY_SCHEMA = {
  type: "object",
  properties: {
    rule: { type: "string" },
    substitute: { type: "string" },
    reason: { type: "string" },
  },
  required: ["rule"],
  additionalProperties: false,
} as const;

const DISABLED_SEVERITIES: ReadonlySet<string> = new Set([LINT_SEVERITY.OFF, "allow", "0"]);

const ENABLED_SEVERITIES: ReadonlySet<string> = new Set([
  LINT_SEVERITY.ERROR,
  "deny",
  LINT_SEVERITY.WARN,
  "1",
  "2",
]);

const holdsEnabledRule = (held: ESTree.Expression): boolean => {
  const spelled = spelledSeverityOf(held);
  if (spelled === null) return true;
  if (DISABLED_SEVERITIES.has(spelled)) return false;
  return ENABLED_SEVERITIES.has(spelled);
};

const RESTRICTION_RULES_OPTION = "restrictionRules";

const RESTRICTION_RULES: readonly { readonly rule: string; readonly substitute: string }[] = [
  {
    rule: "no-restricted-imports",
    substitute: "forbid-declared-module-import--use-declared-replacement",
  },
  {
    rule: "no-restricted-modules",
    substitute: "forbid-declared-module-import--use-declared-replacement",
  },
  {
    rule: "no-restricted-paths",
    substitute: "forbid-module-import-outside-owner--import-through-owner",
  },
  {
    rule: "no-restricted-globals",
    substitute: "forbid-declared-export-reference--use-declared-replacement",
  },
  {
    rule: "no-restricted-properties",
    substitute: "forbid-declared-export-reference--use-declared-replacement",
  },
  { rule: "no-restricted-exports", substitute: "" },
  { rule: "no-restricted-syntax", substitute: "" },
  { rule: "no-restricted-types", substitute: "" },
];

const restrictionRulesIn = (ruleOptions: Readonly<Options>): ReadonlyMap<string, string> => {
  const declared = listedUnder(ruleOptions, RESTRICTION_RULES_OPTION).flatMap(
    ({ rule, substitute }) =>
      typeof rule === "string" && rule !== ""
        ? [{ rule, substitute: typeof substitute === "string" ? substitute : "" }]
        : [],
  );
  return new Map(
    [...RESTRICTION_RULES, ...declared].map((listed): readonly [string, string] => [
      bareRuleNameOf(listed.rule),
      listed.substitute,
    ]),
  );
};

const EXCEPTIONS_OPTION = "exceptions";

const exceptionGroundsIn = (ruleOptions: Readonly<Options>): ReadonlyMap<string, string> =>
  new Map(
    listedUnder(ruleOptions, EXCEPTIONS_OPTION).flatMap(
      ({ rule, reason }): readonly (readonly [string, string])[] =>
        typeof rule === "string" && rule !== ""
          ? [[bareRuleNameOf(rule), typeof reason === "string" ? reason.trim() : ""]]
          : [],
    ),
  );

export const forbidGenericRestrictionRule = createDontReviewItRule({
  name: "forbid-generic-restriction-rule--use-the-declared-rule",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow enabling an off-the-shelf lint rule that reads what it rejects from its own configuration, so every ban this repository declares stands in the rule that carries its replacement and reaches the checks that read the bans",
      relatedGuidelines: [],
    },
    messages: {
      redirectedRestrictionRule:
        "A lint configuration must not enable `{{ruleName}}`, a rule that reads what it rejects from its own configuration. Move each entry to `{{substitute}}` together with the replacement it names, or register `{{ruleName}}` in this rule's `exceptions` option with the grounds it stays.",
      undelegatedRestrictionRule:
        "A lint configuration must not enable `{{ruleName}}`, a rule that reads what it rejects from its own configuration. Write a rule that names the shape it rejects and the repair it demands, or register `{{ruleName}}` in this rule's `exceptions` option with the grounds it stays.",
      groundlessRestrictionException:
        "A registered exception must not stand without grounds. `{{ruleName}}` carries none. Write the grounds into that entry, or delete the entry and move each ban to the rule that receives it.",
    },
    schema: [
      {
        type: "object",
        properties: {
          [RESTRICTION_RULES_OPTION]: { type: "array", items: ENTRY_SCHEMA },
          [EXCEPTIONS_OPTION]: { type: "array", items: ENTRY_SCHEMA },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const restrictionRules = restrictionRulesIn(inspection.options);
    const exceptionGrounds = exceptionGroundsIn(inspection.options);

    const messageFor = (ruleName: string): RuleMessage | null => {
      const bare = bareRuleNameOf(ruleName);
      const substitute = restrictionRules.get(bare);
      if (substitute === undefined) return null;
      const grounds = exceptionGrounds.get(bare);
      if (grounds === "") {
        return { messageId: "groundlessRestrictionException", data: { ruleName, substitute } };
      }
      if (grounds !== undefined) return null;
      return {
        messageId: substitute === "" ? "undelegatedRestrictionRule" : "redirectedRestrictionRule",
        data: { ruleName, substitute },
      };
    };

    const reportEntry = (property: ESTree.ObjectExpression["properties"][number]): void => {
      if (property.type !== "Property") return;
      const ruleName = propertyKeyOf(property);
      if (ruleName === null) return;
      const complaint = messageFor(ruleName);
      if (complaint === null) return;
      if (!holdsEnabledRule(property.value)) return;
      inspection.report({ node: property, ...complaint });
    };

    return {
      ObjectExpression(node: ESTree.ObjectExpression) {
        for (const property of node.properties) reportEntry(property);
      },
    };
  },
});
