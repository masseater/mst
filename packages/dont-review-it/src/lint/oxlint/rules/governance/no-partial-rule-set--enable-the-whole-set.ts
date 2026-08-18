import { createDontReviewItRule } from "../../../../create-rule.ts";
import { ancestorsOf } from "../../lib/ast-node.ts";
import {
  configuredRuleBlockOf,
  ruleBlockObjectOf,
} from "../../lib/rule-sets/configured-rule-blocks.ts";
import {
  PARTIAL_RULE_SET_MESSAGE_ID,
  SCOPED_PARTIAL_RULE_SET_MESSAGE_ID,
  setDeviationsIn,
  TYPELESS_RULE_SET_HOST_MESSAGE_ID,
  UNEVEN_SEVERITY_MESSAGE_ID,
  UNREADABLE_SEVERITY_MESSAGE_ID,
} from "../../lib/rule-sets/set-deviations.ts";

import type { ESTree } from "@oxlint/plugins";

export const noPartialRuleSet = createDontReviewItRule({
  name: "no-partial-rule-set--enable-the-whole-set",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require a configuration naming any rule of a declared set to name the whole set at one severity in one scope on a run carrying the type information those rules read, so a set stands whole or stands nowhere",
      relatedGuidelines: ["docs/guidelines/enforcement.md"],
    },
    messages: {
      [PARTIAL_RULE_SET_MESSAGE_ID]:
        "A lint configuration must not hold part of the `{{ruleSet}}` rule set. This block names `{{namedRule}}` and leaves out {{missingRules}}, and each rule left out opens a hole: {{holes}}. Name every rule of the set in this block at one severity, or name none of them. Part of a set is not a milder discipline, it is the look of one laid over the holes it leaves.",
      [SCOPED_PARTIAL_RULE_SET_MESSAGE_ID]:
        "An override must not take part of the `{{ruleSet}}` rule set out of scope. It covers {{scope}}, names `{{namedRule}}`, and leaves out {{missingRules}}, leaving those paths with the holes: {{holes}}. Give every rule of the set the same scope in this override, or delete the override. Part of a set is not a milder discipline, it is the look of one laid over the paths it covers.",
      [UNEVEN_SEVERITY_MESSAGE_ID]:
        "A lint configuration must not hold the `{{ruleSet}}` rule set at more than one severity. `{{ruleName}}` sits at `{{severity}}` and `{{matchedRule}}` sits at `{{matchedSeverity}}`, and the weaker of the two leaves a hole: {{hole}}. Raise `{{ruleName}}` to `{{matchedSeverity}}`, or lower every rule of the set to one severity. A set split across two severities is not a milder discipline, it is the look of one laid over the half nobody has to obey.",
      [UNREADABLE_SEVERITY_MESSAGE_ID]:
        "A severity this rule cannot read must not stand on `{{ruleName}}`, a rule of the `{{ruleSet}}` set. Write the severity of every rule of the set as a literal in this block, or name none of them.",
      [TYPELESS_RULE_SET_HOST_MESSAGE_ID]:
        "A run carrying no type information must not host `{{ruleName}}`, a rule of the `{{ruleSet}}` set that reads types. Set `options.typeAware` to `true` in this configuration, or take every rule of the set out of it. A typeless run leaves that rule reporting nothing, and this hole stays open: {{hole}}.",
    },
    schema: [],
  },
  create(inspection) {
    return {
      ObjectExpression(node: ESTree.ObjectExpression) {
        const rules = ruleBlockObjectOf(node);
        if (rules === null) return;
        const block = configuredRuleBlockOf({
          object: node,
          rules,
          ancestors: ancestorsOf(node),
        });
        for (const deviation of setDeviationsIn(block)) {
          inspection.report({
            node: deviation.property,
            messageId: deviation.messageId,
            data: deviation.data,
          });
        }
      },
    };
  },
});
