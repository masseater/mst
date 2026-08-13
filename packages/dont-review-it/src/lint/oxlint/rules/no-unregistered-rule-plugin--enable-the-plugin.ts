import { createDontReviewItRule } from "../../../create-rule.ts";
import { propertyKeyOf } from "../lib/object-literal.ts";
import {
  declaredJsPluginNamesIn,
  declaredPluginNamesIn,
} from "../lib/rule-plugins/declared-plugin-names.ts";
import { declaresRuleRecord } from "../lib/rule-plugins/rule-record-declarations.ts";
import { ruleBlockObjectOf } from "../lib/rule-sets/configured-rule-blocks.ts";
import { severityLevelOf, SILENT_LEVEL } from "../lib/rule-sets/severity-levels.ts";

import type { ESTree } from "@oxlint/plugins";

const PLUGIN_SEPARATOR = "/";

const listedPluginsOf = (ruleOptions: readonly unknown[]): readonly string[] => {
  const [held] = ruleOptions;
  if (held === null || typeof held !== "object") return [];
  const listed = (held as { readonly plugins?: unknown }).plugins;
  return Array.isArray(listed)
    ? listed.filter((named): named is string => typeof named === "string")
    : [];
};

export const noUnregisteredRulePlugin = createDontReviewItRule({
  name: "no-unregistered-rule-plugin--enable-the-plugin",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a lint configuration naming a rule of a plugin that no plugin list it can reach enables, so a rule left standing on a dropped plugin is reported instead of resolving to nothing",
      relatedGuidelines: [],
    },
    messages: {
      unregisteredRulePlugin:
        "A lint configuration must not name `{{ruleName}}` while the `{{plugin}}` plugin stands outside every plugin list it hands out. Add `{{plugin}}` to that plugin list, or delete the rule.",
    },
    schema: [
      {
        type: "object",
        properties: {
          plugins: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const enabledPlugins = new Set(listedPluginsOf(inspection.options));
    const namedRuleByProperty = new Map<
      ESTree.ObjectProperty,
      { readonly plugin: string; readonly ruleName: string }
    >();

    const collectNamedRules = (rules: ESTree.ObjectExpression): void => {
      for (const property of rules.properties) {
        if (property.type !== "Property") continue;
        const ruleName = propertyKeyOf(property);
        if (ruleName === null || !ruleName.includes(PLUGIN_SEPARATOR)) continue;
        if (severityLevelOf(property.value) === SILENT_LEVEL) continue;
        namedRuleByProperty.set(property, {
          plugin: ruleName.slice(0, ruleName.indexOf(PLUGIN_SEPARATOR)),
          ruleName,
        });
      }
    };

    return {
      ObjectExpression(node: ESTree.ObjectExpression) {
        for (const named of declaredPluginNamesIn(node)) enabledPlugins.add(named);
        for (const named of declaredJsPluginNamesIn(node)) enabledPlugins.add(named);
        const rules = ruleBlockObjectOf(node);
        if (rules !== null) collectNamedRules(rules);
      },
      VariableDeclarator(node: ESTree.VariableDeclarator) {
        if (!declaresRuleRecord(node)) return;
        if (node.init?.type === "ObjectExpression") collectNamedRules(node.init);
      },
      "Program:exit"() {
        for (const [property, named] of namedRuleByProperty) {
          if (enabledPlugins.has(named.plugin)) continue;
          inspection.report({
            node: property,
            messageId: "unregisteredRulePlugin",
            data: { plugin: named.plugin, ruleName: named.ruleName },
          });
        }
      },
    };
  },
});
